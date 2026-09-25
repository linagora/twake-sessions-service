import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const required = {
  RABBITMQ_URL: 'amqp://guest:guest@localhost:5672',
  LLNG_MANAGER_URL: 'https://manager.example.com/',
  LLNG_PORTAL_URL: 'https://auth.example.com',
  LLNG_ADMIN_USER: 'admin',
  LLNG_ADMIN_PASSWORD: 'secret',
};

describe('loadConfig', () => {
  it('applies the defaults', () => {
    const config = loadConfig(required);

    expect(config.bindings).toEqual({
      userDeleted: { exchange: 'auth', routingKey: 'user.deleted', queue: 'sessions-service.user-deleted' },
      domainUserDeleted: {
        exchange: 'b2b',
        routingKey: 'domain.user.deleted',
        queue: 'sessions-service.domain-user-deleted',
      },
      memberDisabled: {
        exchange: 'b2b',
        routingKey: 'b2b.member.disabled',
        queue: 'sessions-service.member-disabled',
      },
    });
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
      RABBITMQ_MEMBER_DISABLED_QUEUE: 'custom.queue',
      SESSIONS_MAX_PASSES: '5',
    });

    expect(config.bindings.memberDisabled.queue).toBe('custom.queue');
    expect(config.llng.maxPasses).toBe(5);
  });

  it.each(Object.keys(required))('fails when %s is missing', key => {
    expect(() => loadConfig({ ...required, [key]: undefined })).toThrow(key);
  });

  it('rejects an invalid manager URL', () => {
    expect(() => loadConfig({ ...required, LLNG_MANAGER_URL: 'manager' })).toThrow('LLNG_MANAGER_URL');
  });
});
