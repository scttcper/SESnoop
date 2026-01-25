# SESnoop

SESnoop is a cloudflare worker dashboard for Amazon SES delivery events. It ingests SNS notifications (deliveries, bounces, complaints) via webhooks and provides a modern React UI to explore message history and delivery metrics.

Built on Cloudflare Workers and D1, it offers a serverless, low-cost alternative to third-party email monitoring tools.

Based on the excellent work by [marckohlbrugge/sessy](https://github.com/marckohlbrugge/sessy), a Rails app for the same purpose.

## Features

- **Webhook Ingestion**: Accepts SNS notifications securely, verifies signatures, and deduplicates events.
- **Event Explorer**: Search and filter event history by type (Delivery, Bounce, Complaint), date range, and specific message IDs.
- **Message Insight**: Detailed timeline view for individual messages, including metadata and tags.
- **Dashboard Metrics**: Analyze daily volume, open rates, click rates, and bounce statistics.
- **Multi-Source Support**: Manage multiple SES identities or environments (e.g., staging vs. prod) with unique webhook URLs.
- **Data Retention**: Configurable per-source retention policies with automatic cleanup of old data.
- **Security**: Optional Basic Auth for the UI and API.

## Architecture

- **UI**: React + TanStack Router + TanStack Query.
- **API**: Hono (OpenAPI compliant) running on Cloudflare Workers.
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM.
- **Infrastructure**: Fully serverless; the Worker serves both the static UI assets and the API.

## Quickstart

To run the project locally:

1.  **Install dependencies**:

    ```bash
    pnpm install
    ```

2.  **Start the development server**:
    ```bash
    pnpm dev
    ```
    This starts Vite and the Worker in local mode. Open the URL provided (default: `http://localhost:5173`).

## Deployment

### 1. Database Setup

Before deploying, you need to set up the D1 database.

1.  Create a new D1 database:

    ```bash
    wrangler d1 create sesnoop
    ```

2.  Update `wrangler.jsonc` with your new database ID:
    - Set `d1_databases[0].database_id` to the ID returned by the create command.
    - Ensure the binding name remains `DB`.

3.  Apply migrations to create the schema:
    ```bash
    wrangler d1 migrations apply sesnoop
    ```

### 2. Deploy Worker

Build the UI and deploy the worker to Cloudflare:

```bash
pnpm deploy
```

## Configuration

### Webhook Setup (Connect SES to SESnoop)

Once deployed, you need to tell Amazon SES where to send events.

1.  Open your deployed SESnoop dashboard.
2.  Navigate to **Sources** and create a new source.
3.  Click **Setup** on the new source to view detailed instructions.
4.  The guide will provide:
    - A unique Webhook URL: `https://<your-worker>/api/webhooks/<source_token>`
    - Instructions for creating an SES Configuration Set and SNS Topic.
    - Steps to subscribe your unique URL to the SNS Topic.

_Note: The webhook endpoint handles SNS `SubscriptionConfirmation` automatically._

### Authentication

You can protect the UI and API (excluding public webhooks) with a cookie-based login by setting environment variables in Cloudflare or your `wrangler.jsonc` (for dev). The UI will prompt for credentials when auth is enabled.

### Environment Variables

Configure these via the Cloudflare Dashboard or Wrangler:

| Variable                       | Description                                                                       |
| :----------------------------- | :-------------------------------------------------------------------------------- |
| `AUTH_USERNAME`                | Optional. Username for cookie-based auth.                                         |
| `AUTH_PASSWORD`                | Optional. Password for cookie-based auth.                                         |
| `AUTH_JWT_SECRET`              | Required when auth is enabled. Secret used to sign JWT cookies.                   |
| `AUTH_COOKIE_NAME`             | Optional. Cookie name (default: `sesnoop_auth`).                                  |
| `AUTH_COOKIE_TTL_SECONDS`      | Optional. Cookie lifetime in seconds (default: 30 days).                          |
| `SNS_DISABLE_SIGNATURE_VERIFY` | Set to `true` to skip SNS signature verification (useful for local testing).      |
| `DB_DISABLE_TRANSACTIONS`      | Set to `true` to disable D1 transactions during ingestion (useful for debugging). |

### Data Retention

Each source has a `retention_days` setting. A daily cron job (configured in `wrangler.jsonc`) automatically removes messages and events older than the configured limit to save storage. If unset, data is kept indefinitely.

## API & Documentation

The application includes a fully documented OpenAPI specification.

- **JSON Spec**: `/api/doc`
- **Swagger UI**: `/api/reference`

**Key Endpoints**:

- `GET /api/sources/:id/events` - Search and filter events.
- `GET /api/sources/:id/overview` - Aggregate dashboard metrics.
- `GET /api/sources/:id/messages/:id` - Detailed message view.
- `POST /api/webhooks/:source_token` - Public endpoint for SNS ingestion.

## Development Scripts

```bash
pnpm dev        # Run locally (Vite + Wrangler)
pnpm build      # Build the React UI
pnpm preview    # Build and preview locally
pnpm deploy     # Build and deploy to Cloudflare
pnpm test       # Run tests (Vitest)
pnpm cf-typegen # Generate types from Wrangler bindings
```
