# twake-sessions-service

Ends a user's [LemonLDAP::NG](https://lemonldap-ng.org) sessions when a RabbitMQ message names that user.

It works with the LemonLDAP::NG manager's sessions API. For each message it reads an email address, then deletes every global and offline (OIDC refresh token) session traced to it.

## Messages

Each subscription binds a queue to an exchange and routing key, and names the message field holding the email address:

```json
[{ "exchange": "events", "routingKey": "user.deleted", "queue": "sessions.user-deleted", "emailField": "email" }]
```

- The address is lowercased and looked up in `_whatToTrace`, so LemonLDAP::NG must trace users by email.
- A user with no session counts as success, so a message can be replayed safely.
- A message without a valid address is rejected and ends up in the dead-letter queue.
- LemonLDAP::NG errors are retried, then the message is dead-lettered.

Queues are quorum queues, each with a `<queue>.dlq` bound to `<exchange>.dlx`.

## LemonLDAP::NG calls

- `GET` then `POST` on the portal with the admin account, to get an admin session. It is reused, and renewed when the manager answers 401 or redirects to the portal.
- `GET /manager.psgi/sessions/{global|offline}?_whatToTrace={email}`
- `DELETE /manager.psgi/sessions/{global|offline}/{id}`

Success is decided by listing again after deleting. The manager answers 500 when deleting a session that is already gone, so a failed `DELETE` only matters if the session is still listed after `SESSIONS_MAX_PASSES` rounds.

The admin account needs access to the manager's sessions API.

## Configuration

See [.env.example](.env.example). Required: `RABBITMQ_URL`, `SUBSCRIPTIONS`, `LLNG_MANAGER_URL`, `LLNG_PORTAL_URL`, `LLNG_ADMIN_USER`, `LLNG_ADMIN_PASSWORD`.

`GET /healthz` on `PORT` answers 200 while the RabbitMQ connection is up, 503 otherwise.

## Development

```sh
npm ci
npm run typecheck && npm run lint && npm test
cp .env.example .env && npm run dev
```
