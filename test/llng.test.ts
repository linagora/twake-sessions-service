import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LlngManager } from '../src/llng.js';
import { createLogger } from '../src/logger.js';

const config = {
  managerUrl: 'https://manager.example.com',
  portalUrl: 'https://auth.example.com',
  adminUser: 'admin',
  adminPassword: 'secret',
  cookieName: 'lemonldap',
  maxPasses: 2,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const list = (...ids: string[]) =>
  json({ result: 1, count: ids.length, values: ids.map(session => ({ session, date: 0 })) });

/**
 * Routes requests by method and path. Each route is a queue of responses; the
 * last one repeats. The portal answers the login flow unless overridden.
 */
function mockFetch(routes: Record<string, Array<() => Response>>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = `${init?.method ?? 'GET'} ${url.pathname}${url.search}`;
    calls.push(key);
    const queue =
      routes[key] ??
      (url.host === 'auth.example.com'
        ? [init?.method === 'POST' ? () => json({ result: 1, id: 'admin-cookie' }) : () => json({ token: 't' }, 401)]
        : undefined);
    if (!queue) {
      throw new Error(`Unexpected request ${key}`);
    }
    return (queue.length > 1 ? queue.shift()! : queue[0])();
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

const GLOBAL = 'GET /manager.psgi/sessions/global?_whatToTrace=alice%40example.com';
const OFFLINE = 'GET /manager.psgi/sessions/offline?_whatToTrace=alice%40example.com';

describe('LlngManager.endSessions', () => {
  let manager: LlngManager;

  beforeEach(() => {
    manager = new LlngManager(config, createLogger('silent'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('succeeds without deleting anything when the user has no session', async () => {
    const { calls } = mockFetch({ [GLOBAL]: [() => list()], [OFFLINE]: [() => list()] });

    await expect(manager.endSessions('alice@example.com')).resolves.toBe(0);
    expect(calls.filter(call => call.startsWith('DELETE'))).toEqual([]);
  });

  it('deletes global and offline sessions even when both exist', async () => {
    const { calls } = mockFetch({
      [GLOBAL]: [() => list('g1', 'g2'), () => list()],
      [OFFLINE]: [() => list('o1'), () => list()],
      'DELETE /manager.psgi/sessions/global/g1': [() => json({ result: 1 })],
      'DELETE /manager.psgi/sessions/global/g2': [() => json({ result: 1 })],
      'DELETE /manager.psgi/sessions/offline/o1': [() => json({ result: 1 })],
    });

    await expect(manager.endSessions('alice@example.com')).resolves.toBe(3);
    expect(calls.filter(call => call.startsWith('DELETE'))).toHaveLength(3);
  });

  it('deletes offline sessions when there is no global session', async () => {
    mockFetch({
      [GLOBAL]: [() => list()],
      [OFFLINE]: [() => list('o1'), () => list()],
      'DELETE /manager.psgi/sessions/offline/o1': [() => json({ result: 1 })],
    });

    await expect(manager.endSessions('alice@example.com')).resolves.toBe(1);
  });

  it('succeeds when a refused deletion was for a session already gone', async () => {
    mockFetch({
      [GLOBAL]: [() => list('g1'), () => list()],
      [OFFLINE]: [() => list()],
      'DELETE /manager.psgi/sessions/global/g1': [() => new Response('error', { status: 500 })],
    });

    await expect(manager.endSessions('alice@example.com')).resolves.toBe(0);
  });

  it('throws when sessions remain after the last pass', async () => {
    const { calls } = mockFetch({
      [GLOBAL]: [() => list('g1')],
      [OFFLINE]: [() => list()],
      'DELETE /manager.psgi/sessions/global/g1': [() => json({ error: 'nope' })],
    });

    await expect(manager.endSessions('alice@example.com')).rejects.toThrow(
      '1 session(s) still present after 2 passes',
    );
    expect(calls.filter(call => call.startsWith('DELETE'))).toHaveLength(2);
  });

  it('throws when listing fails instead of reporting no sessions', async () => {
    mockFetch({ [GLOBAL]: [() => new Response('boom', { status: 500 })] });

    await expect(manager.endSessions('alice@example.com')).rejects.toThrow(
      'Listing global sessions failed with status 500',
    );
  });

  it('throws when the list body is not a manager answer', async () => {
    mockFetch({ [GLOBAL]: [() => json({ error: 'x' })] });

    await expect(manager.endSessions('alice@example.com')).rejects.toThrow('Listing global sessions failed');
  });

  it.each([401, 302])('logs in again once when the manager answers %i', async status => {
    const { calls } = mockFetch({
      [GLOBAL]: [() => new Response(null, { status }), () => list()],
      [OFFLINE]: [() => list()],
    });

    await expect(manager.endSessions('alice@example.com')).resolves.toBe(0);
    expect(calls.filter(call => call === 'POST /')).toHaveLength(2);
  });

  it('gives up when a fresh admin session is rejected too', async () => {
    mockFetch({ [GLOBAL]: [() => new Response(null, { status: 401 })] });

    await expect(manager.endSessions('alice@example.com')).rejects.toThrow(
      'LemonLDAP manager rejected a fresh admin session',
    );
  });

  it('sends the admin cookie and reuses it across calls', async () => {
    const { fetchMock, calls } = mockFetch({ [GLOBAL]: [() => list()], [OFFLINE]: [() => list()] });

    await manager.endSessions('alice@example.com');
    await manager.endSessions('alice@example.com');

    expect(calls.filter(call => call === 'POST /')).toHaveLength(1);
    const managerCall = fetchMock.mock.calls.find(([input]) => String(input).includes('manager.psgi'));
    expect(managerCall?.[1]?.headers).toMatchObject({ Cookie: 'lemonldap=admin-cookie' });
  });

  it('throws when the portal login fails, and retries the login next time', async () => {
    mockFetch({
      'POST /': [() => json({ result: 0, error: 5 }, 401), () => json({ result: 1, id: 'admin-cookie' })],
      [GLOBAL]: [() => list()],
      [OFFLINE]: [() => list()],
    });

    await expect(manager.endSessions('alice@example.com')).rejects.toThrow(
      'LemonLDAP portal login failed with status 401',
    );
    await expect(manager.endSessions('alice@example.com')).resolves.toBe(0);
  });
});
