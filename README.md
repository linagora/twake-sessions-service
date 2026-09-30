# twake-sessions-service

Ends a user's [LemonLDAP::NG](https://lemonldap-ng.org) sessions when a RabbitMQ message names that user.

It works with the LemonLDAP::NG manager's sessions API. For each message it reads an email address, then deletes every global and offline (OIDC refresh token) session traced to it. A user with no session counts as success, so a message can be replayed safely.

## Requirements

- RabbitMQ with quorum queues (3.8 or later).
- LemonLDAP::NG with the manager's sessions API, an admin account allowed to use it, and users traced by lowercased email address (`whatToTrace` set to `lc($mail)`).

## Docs

- [How it works](docs/how-it-works.md): message handling, retries, dead-lettering and the LemonLDAP::NG calls.
- [Configuration](docs/configuration.md): environment variables, subscriptions and running the image.

## Running it

Images are published to `ghcr.io/linagora/twake-sessions-service`: `latest` follows `main`, and each release has its own tag, such as `v0.1.0`.

```sh
docker run \
  -e RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672 \
  -e SUBSCRIPTIONS='[{"exchange":"events","routingKey":"user.deleted","queue":"sessions.user-deleted"}]' \
  -e LLNG_MANAGER_URL=https://manager.example.com \
  -e LLNG_PORTAL_URL=https://auth.example.com \
  -e LLNG_ADMIN_USER=admin \
  -e LLNG_ADMIN_PASSWORD=change-me \
  ghcr.io/linagora/twake-sessions-service:latest
```

## Development

Needs Node.js 20 or later.

```sh
npm ci
npm run typecheck && npm run lint && npm test
npm run build
cp .env.example .env && npm run dev
```

## Releasing

Push a tag named after the version, such as `v0.2.0`. CI runs the checks, publishes the image with that tag and creates the GitHub release.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## License

This project is licensed under the GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later), see the [LICENSE](./LICENSE) file for details.
