import type { RabbitMQMessageHandler } from '@linagora/rabbitmq-client';
import { z } from 'zod';
import type { LlngManager } from './llng.js';
import type { Logger } from './logger.js';

// z.email() also rejects '*', which the manager would treat as a wildcard.
const email = z.string().trim().toLowerCase().pipe(z.email());

/**
 * A message without a valid address throws, so it lands in the dead-letter
 * queue where operators see it, instead of being acknowledged unnoticed.
 */
export function createHandler(
  field: 'internalEmail' | 'email',
  llng: Pick<LlngManager, 'endSessions'>,
  logger: Logger,
): RabbitMQMessageHandler {
  const schema = z.object({ [field]: email });

  return async message => {
    const parsed = schema.safeParse(message);
    if (!parsed.success) {
      throw new Error(`Message carries no valid ${field}`);
    }
    const address = parsed.data[field];
    const deleted = await llng.endSessions(address);
    logger.info({ email: address, deleted }, 'Sessions ended');
  };
}
