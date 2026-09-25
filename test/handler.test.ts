import { describe, expect, it, vi } from 'vitest';
import { createHandler } from '../src/handler.js';
import { createLogger } from '../src/logger.js';

const logger = createLogger('silent');
const properties = { headers: {} };

function setup(field = 'email') {
  const llng = { endSessions: vi.fn().mockResolvedValue(1) };
  return { llng, handle: createHandler(field, llng, logger) };
}

describe('createHandler', () => {
  it('ends the sessions of the user, lowercased', async () => {
    const { llng, handle } = setup();

    await handle({ email: ' Alice@Example.COM ', userId: 'alice' }, properties);

    expect(llng.endSessions).toHaveBeenCalledWith('alice@example.com');
  });

  it('reads the configured field', async () => {
    const { llng, handle } = setup('mail');

    await handle({ mail: 'bob@example.com', email: 'other@example.com' }, properties);

    expect(llng.endSessions).toHaveBeenCalledWith('bob@example.com');
  });

  it.each([
    ['missing', { userId: 'alice' }],
    ['not an address', { email: 'alice' }],
    ['a wildcard', { email: '*@example.com' }],
  ])('throws so the message is dead-lettered when the address is %s', async (_, message) => {
    const { llng, handle } = setup();

    await expect(handle(message, properties)).rejects.toThrow('Message carries no valid email');
    expect(llng.endSessions).not.toHaveBeenCalled();
  });

  it('propagates LemonLDAP failures so the message is retried', async () => {
    const { llng, handle } = setup();
    llng.endSessions.mockRejectedValue(new Error('down'));

    await expect(handle({ email: 'alice@example.com' }, properties)).rejects.toThrow('down');
  });
});
