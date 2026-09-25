import { z } from 'zod';

const text = z.string().trim().min(1);
const url = z.url().transform(value => value.replace(/\/+$/, ''));
const count = (fallback: number) => z.coerce.number().int().min(1).default(fallback);

const subscriptions = z
  .string()
  .transform((value, ctx) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'must be valid JSON' });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(
        z.object({
          exchange: text,
          routingKey: text,
          queue: text,
          emailField: text.default('email'),
        }),
      )
      .min(1),
  );

const envSchema = z.object({
  RABBITMQ_URL: text,
  RABBITMQ_MAX_RETRIES: count(3),
  RABBITMQ_RETRY_DELAY: count(1000),
  RABBITMQ_PREFETCH: count(10),
  SUBSCRIPTIONS: subscriptions,

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
    subscriptions: values.SUBSCRIPTIONS,
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
