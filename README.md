# twake-sessions-service

Ends a user's [LemonLDAP::NG](https://lemonldap-ng.org) sessions when a RabbitMQ message names that user.

It works with the LemonLDAP::NG manager's sessions API. For each message it reads an email address, then deletes every global and offline (OIDC refresh token) session traced to it. A user with no session counts as success, so a message can be replayed safely.

## Docs

- [How it works](docs/how-it-works.md): message handling, retries, dead-lettering and the LemonLDAP::NG calls.
- [Configuration](docs/configuration.md): environment variables, subscriptions and running the image.

## Quick start

```sh
docker build -t twake-sessions-service .
docker run \
  -e RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672 \
  -e SUBSCRIPTIONS='[{"exchange":"events","routingKey":"user.deleted","queue":"sessions.user-deleted"}]' \
  -e LLNG_MANAGER_URL=https://manager.example.com \
  -e LLNG_PORTAL_URL=https://auth.example.com \
  -e LLNG_ADMIN_USER=admin \
  -e LLNG_ADMIN_PASSWORD=change-me \
  twake-sessions-service
```

## Development

```sh
npm ci
npm run typecheck && npm run lint && npm test
cp .env.example .env && npm run dev
```
