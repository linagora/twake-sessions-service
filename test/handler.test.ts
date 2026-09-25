import { describe, expect, it, vi } from 'vitest';
import { createHandler } from '../src/handler.js';
import { createLogger } from '../src/logger.js';

const logger = createLogger('silent');
const properties = { headers: {} };

function setup(field: 'internalEmail' | 'email') {
  const llng = { endSessions: vi.fn().mockResolvedValue(1) };
  return { llng, handle: createHandler(field, llng, logger) };
}

describe('createHandler', () => {
  it('ends the sessions of the deleted user, lowercased', async () => {
    const { llng, handle } = setup('internalEmail');

    await handle({ internalEmail: ' Alice@Example.COM ', userId: 'alice' }, properties);

    expect(llng.endSessions).toHaveBeenCalledWith('alice@example.com');
  });

  it('reads email on member events', async () => {
    const { llng, handle } = setup('email');

    await handle({ email: 'bob@example.com', organizationId: 'acme1234' }, properties);

    expect(llng.endSessions).toHaveBeenCalledWith('bob@example.com');
  });

  it.each([
    ['missing', { workplaceFqdn: 'alice.twake.app' }],
    ['not an address', { internalEmail: 'alice' }],
    ['a wildcard', { internalEmail: '*@example.com' }],
  ])('throws so the message is dead-lettered when the address is %s', async (_, message) => {
    const { llng, handle } = setup('internalEmail');

    await expect(handle(message, properties)).rejects.toThrow('Message carries no valid internalEmail');
    expect(llng.endSessions).not.toHaveBeenCalled();
  });

  it('propagates LemonLDAP failures so the message is retried', async () => {
    const { llng, handle } = setup('internalEmail');
    llng.endSessions.mockRejectedValue(new Error('down'));

    await expect(handle({ internalEmail: 'alice@example.com' }, properties)).rejects.toThrow('down');
  });
});
