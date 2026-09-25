import { createServer } from 'node:http';
import { RabbitMQClient } from '@linagora/rabbitmq-client';
import { loadConfig } from './config.js';
import { createHandler } from './handler.js';
import { LlngManager } from './llng.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const llng = new LlngManager(config.llng, logger);

const client = new RabbitMQClient({
  url: config.rabbitmq.url,
  maxRetries: config.rabbitmq.maxRetries,
  retryDelay: config.rabbitmq.retryDelay,
  prefetch: config.rabbitmq.prefetch,
  logger,
});
await client.init();

for (const { exchange, routingKey, queue, emailField } of config.subscriptions) {
  await client.subscribe(exchange, routingKey, queue, createHandler(emailField, llng, logger));
  logger.info({ exchange, routingKey, queue }, 'Subscribed');
}

const server = createServer((request, response) => {
  if (request.url !== '/healthz') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(client.isConnected() ? 200 : 503).end();
}).listen(config.port);

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    logger.info({ signal }, 'Shutting down');
    server.close();
    await client.close();
    process.exit(0);
  });
}
