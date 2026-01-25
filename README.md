```txt
pnpm install
pnpm dev
```

```txt
pnpm deploy
```

API endpoints:

```txt
GET /api/            -> { name: "Cloudflare" }
GET /api/doc         -> OpenAPI spec
GET /api/reference   -> API reference UI
```

D1 setup:

- Update `wrangler.jsonc` with your D1 `database_id`.
- Create the `tasks` table before using the Tasks endpoints.

Webhook ingestion:

- SNS signatures are verified by default.
- Set `SNS_DISABLE_SIGNATURE_VERIFY=true` only for local/dev testing.

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
pnpm cf-typegen
```
