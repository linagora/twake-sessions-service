# Configuration

All settings are environment variables. The service checks them at startup and exits with an error that names each invalid one.

## RabbitMQ

- `RABBITMQ_URL` (required): AMQP URL, including credentials and vhost.
- `SUBSCRIPTIONS` (required): a JSON array with at least one subscription. Each one has:
  - `exchange`: the exchange to bind to.
  - `routingKey`: the routing key to bind.
  - `queue`: the queue to declare and consume.
  - `emailField`: the message field holding the address, `email` by default.
- `RABBITMQ_MAX_RETRIES`: attempts before a failed message is dead-lettered, 3 by default.
- `RABBITMQ_RETRY_DELAY`: milliseconds between attempts, 1000 by default.
- `RABBITMQ_PREFETCH`: messages handled at once, 10 by default.

Two subscriptions reading different fields:

```sh
SUBSCRIPTIONS='[
  {"exchange":"events","routingKey":"user.deleted","queue":"sessions.user-deleted"},
  {"exchange":"events","routingKey":"user.disabled","queue":"sessions.user-disabled","emailField":"mail"}
]'
```

## LemonLDAP::NG

- `LLNG_MANAGER_URL` (required): base URL of the manager.
- `LLNG_PORTAL_URL` (required): base URL of the portal, used to log in.
- `LLNG_ADMIN_USER`, `LLNG_ADMIN_PASSWORD` (required): an account allowed to use the manager's sessions API.
- `LLNG_COOKIE_NAME`: the SSO cookie name, `lemonldap` by default.
- `SESSIONS_MAX_PASSES`: rounds of deletes before a message fails, 3 by default.

LemonLDAP::NG has to trace users by email address (`whatToTrace`), since that is how sessions are looked up.

## Service

- `PORT`: port of the health endpoint, 8080 by default.
- `LOG_LEVEL`: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`, `info` by default.

## Running it

- The Docker image runs `node dist/index.js` as the `node` user.
- `GET /healthz` answers 200 while the RabbitMQ connection is up, 503 otherwise.
- On `SIGTERM` or `SIGINT` the service stops consuming, closes the connection and exits.
- `RABBITMQ_URL` and `LLNG_ADMIN_PASSWORD` are secrets.
