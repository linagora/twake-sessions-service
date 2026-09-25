import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const required = {
  RABBITMQ_URL: 'amqp://guest:guest@localhost:5672',
  SUBSCRIPTIONS: JSON.stringify([{ exchange: 'events', routingKey: 'user.deleted', queue: 'sessions.user-deleted' }]),
  LLNG_MANAGER_URL: 'https://manager.example.com/',
  LLNG_PORTAL_URL: 'https://auth.example.com',
  LLNG_ADMIN_USER: 'admin',
  LLNG_ADMIN_PASSWORD: 'secret',
};

describe('loadConfig', () => {
  it('applies the defaults', () => {
    const config = loadConfig(required);

    expect(config.subscriptions).toEqual([
      { exchange: 'events', routingKey: 'user.deleted', queue: 'sessions.user-deleted', emailField: 'email' },
    ]);
    expect(config.llng).toMatchObject({
      managerUrl: 'https://manager.example.com',
      cookieName: 'lemonldap',
      maxPasses: 3,
    });
    expect(config.rabbitmq).toMatchObject({ maxRetries: 3, retryDelay: 1000, prefetch: 10 });
    expect(config.port).toBe(8080);
  });

  it('reads overrides', () => {
    const config = loadConfig({
      ...required,
      SUBSCRIPTIONS: JSON.stringify([
        { exchange: 'events', routingKey: 'user.deleted', queue: 'q1', emailField: 'mail' },
        { exchange: 'events', routingKey: 'user.disabled', queue: 'q2' },
      ]),
      SESSIONS_MAX_PASSES: '5',
    });

    expect(config.subscriptions.map(subscription => subscription.emailField)).toEqual(['mail', 'email']);
    expect(config.llng.maxPasses).toBe(5);
  });

  it.each(Object.keys(required))('fails when %s is missing', key => {
    expect(() => loadConfig({ ...required, [key]: undefined })).toThrow(key);
  });

  it.each([
    ['not JSON', 'nope'],
    ['empty', '[]'],
    ['missing a queue', JSON.stringify([{ exchange: 'events', routingKey: 'user.deleted' }])],
  ])('rejects subscriptions that are %s', (_, value) => {
    expect(() => loadConfig({ ...required, SUBSCRIPTIONS: value })).toThrow('SUBSCRIPTIONS');
  });

  it('rejects an invalid manager URL', () => {
    expect(() => loadConfig({ ...required, LLNG_MANAGER_URL: 'manager' })).toThrow('LLNG_MANAGER_URL');
  });
});
