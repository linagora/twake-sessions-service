import { z } from 'zod';

const text = z.string().trim().min(1);
const url = z.url().transform(value => value.replace(/\/+$/, ''));
const count = (fallback: number) => z.coerce.number().int().min(1).default(fallback);

const envSchema = z.object({
  RABBITMQ_URL: text,
  RABBITMQ_MAX_RETRIES: count(3),
  RABBITMQ_RETRY_DELAY: count(1000),
  RABBITMQ_PREFETCH: count(10),
  RABBITMQ_AUTH_EXCHANGE: text.default('auth'),
  RABBITMQ_B2B_EXCHANGE: text.default('b2b'),
  RABBITMQ_USER_DELETED_KEY: text.default('user.deleted'),
  RABBITMQ_USER_DELETED_QUEUE: text.default('sessions-service.user-deleted'),
  RABBITMQ_DOMAIN_USER_DELETED_KEY: text.default('domain.user.deleted'),
  RABBITMQ_DOMAIN_USER_DELETED_QUEUE: text.default('sessions-service.domain-user-deleted'),
  RABBITMQ_MEMBER_DISABLED_KEY: text.default('b2b.member.disabled'),
  RABBITMQ_MEMBER_DISABLED_QUEUE: text.default('sessions-service.member-disabled'),

  LLNG_MANAGER_URL: url,
  LLNG_PORTAL_URL: url,
  LLNG_ADMIN_USER: text,
  LLNG_ADMIN_PASSWORD: text,
  LLNG_COOKIE_NAME: text.default('lemonldap'),
  SESSIONS_MAX_PASSES: count(3),

  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = ReturnType<typeof loadConfig>;
export type LlngConfig = Config['llng'];

export function loadConfig(env: Record<string, string | undefined> = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    );
  }
  const values = parsed.data;

  return {
    rabbitmq: {
      url: values.RABBITMQ_URL,
      maxRetries: values.RABBITMQ_MAX_RETRIES,
      retryDelay: values.RABBITMQ_RETRY_DELAY,
      prefetch: values.RABBITMQ_PREFETCH,
    },
    bindings: {
      userDeleted: {
        exchange: values.RABBITMQ_AUTH_EXCHANGE,
        routingKey: values.RABBITMQ_USER_DELETED_KEY,
        queue: values.RABBITMQ_USER_DELETED_QUEUE,
      },
      domainUserDeleted: {
        exchange: values.RABBITMQ_B2B_EXCHANGE,
        routingKey: values.RABBITMQ_DOMAIN_USER_DELETED_KEY,
        queue: values.RABBITMQ_DOMAIN_USER_DELETED_QUEUE,
      },
      memberDisabled: {
        exchange: values.RABBITMQ_B2B_EXCHANGE,
        routingKey: values.RABBITMQ_MEMBER_DISABLED_KEY,
        queue: values.RABBITMQ_MEMBER_DISABLED_QUEUE,
      },
    },
    llng: {
      managerUrl: values.LLNG_MANAGER_URL,
      portalUrl: values.LLNG_PORTAL_URL,
      adminUser: values.LLNG_ADMIN_USER,
      adminPassword: values.LLNG_ADMIN_PASSWORD,
      cookieName: values.LLNG_COOKIE_NAME,
      maxPasses: values.SESSIONS_MAX_PASSES,
    },
    port: values.PORT,
    logLevel: values.LOG_LEVEL,
  };
}
