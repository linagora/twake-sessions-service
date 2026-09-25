import type { LlngConfig } from './config.js';
import type { Logger } from './logger.js';

// `offline` holds the OIDC offline sessions (refresh tokens).
const SESSION_TYPES = ['global', 'offline'] as const;
// Without it a hung LemonLDAP holds a consumer slot for undici's 300s default, per call.
const TIMEOUT_MS = 30_000;
type SessionType = (typeof SESSION_TYPES)[number];

interface Session {
  type: SessionType;
  id: string;
}

export class LlngManager {
  private adminSession: Promise<string> | undefined;

  constructor(
    private readonly config: LlngConfig,
    private readonly logger: Logger,
  ) {}

  /**
   * Ends every global and offline session traced to `email`, and resolves with
   * how many it deleted. The manager's list is the source of truth: a failed
   * DELETE (including one for a session already gone, which the manager does
   * not answer with a 404) only fails the call if the session is still listed
   * after `maxPasses` rounds.
   */
  async endSessions(email: string): Promise<number> {
    let deleted = 0;
    for (let pass = 1; ; pass++) {
      const sessions = await this.listSessions(email);
      if (sessions.length === 0) {
        return deleted;
      }
      if (pass > this.config.maxPasses) {
        throw new Error(
          `${sessions.length} session(s) still present after ${this.config.maxPasses} passes`,
        );
      }
      for (const session of sessions) {
        if (await this.deleteSession(session)) {
          deleted++;
        }
      }
    }
  }

  private async listSessions(email: string): Promise<Session[]> {
    const sessions: Session[] = [];
    for (const type of SESSION_TYPES) {
      const response = await this.request(
        'GET',
        `${type}?_whatToTrace=${encodeURIComponent(email)}`,
      );
      const body = (await response.json().catch(() => undefined)) as
        | { result?: number; values?: { session: string }[] }
        | undefined;
      if (!response.ok || body?.result !== 1 || !Array.isArray(body.values)) {
        throw new Error(`Listing ${type} sessions failed with status ${response.status}`);
      }
      sessions.push(...body.values.map(value => ({ type, id: value.session })));
    }
    return sessions;
  }

  private async deleteSession({ type, id }: Session): Promise<boolean> {
    const response = await this.request('DELETE', `${type}/${encodeURIComponent(id)}`);
    const body = (await response.json().catch(() => undefined)) as { result?: number } | undefined;
    if (response.ok && body?.result === 1) {
      return true;
    }
    this.logger.warn({ type, status: response.status }, 'Session deletion refused');
    return false;
  }

  private async request(method: 'GET' | 'DELETE', path: string): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt++) {
      this.adminSession ??= this.login().catch(error => {
        this.adminSession = undefined;
        throw error;
      });
      const session = this.adminSession;
      const cookie = await session;

      const response = await fetch(`${this.config.managerUrl}/manager.psgi/sessions/${path}`, {
        method,
        headers: { Accept: 'application/json', Cookie: `${this.config.cookieName}=${cookie}` },
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // An expired admin session is answered 401 to JSON clients, or redirected to the portal.
      if (response.status !== 401 && response.status !== 302) {
        return response;
      }
      await response.body?.cancel();
      if (this.adminSession === session) {
        this.adminSession = undefined;
      }
    }
    throw new Error('LemonLDAP manager rejected a fresh admin session');
  }

  private async login(): Promise<string> {
    // The portal answers the token request with a 401 and a JSON body.
    const tokenResponse = await fetch(this.config.portalUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const { token } = (await tokenResponse.json().catch(() => ({}))) as { token?: string };

    const form = new URLSearchParams({
      user: this.config.adminUser,
      password: this.config.adminPassword,
    });
    if (token) {
      form.set('token', token);
    }
    const response = await fetch(this.config.portalUrl, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const { id } = (await response.json().catch(() => ({}))) as { id?: string };
    if (!response.ok || !id) {
      throw new Error(`LemonLDAP portal login failed with status ${response.status}`);
    }
    this.logger.info('Logged in to the LemonLDAP portal');
    return id;
  }
}
