# ingest

Railway Template Metrics Ingestor. Collects earnings and template metrics from Railway API and persists them to PostgreSQL.

## What gets collected

Each run writes three sets of rows:

| Table | Source | Contents |
|-------|--------|----------|
| `earnings_snapshots` | `earningDetails` | Workspace earnings, in cents |
| `template_snapshots` | `workspaceTemplates` | Per-template metadata, project counts, payout |
| `template_deployment_snapshots` | `templateMetrics` | Per-template deploy counts, health, earnings in dollars |

The two template tables count different things. `template_snapshots.projects`
counts projects created from a template; `template_deployment_snapshots.total_deployments`
counts deploys, redeploys of an existing install included, and that is the
population Railway's health percentage is calculated over.

Health on its own cannot answer "how many deploys failed since yesterday" - it is
a percentage over a rolling window, so it climbs back up as old failures age out
of that window. `failed_deployments` stores the count the percentage implies, and
the `template_deployment_failures` view differences consecutive snapshots into
`deployments_added` and `failures_added`, which does answer it.

`templateMetrics` accepts one template id per call, so the query is built with an
alias per template and sent in batches of 40 - Railway rejects a query whose
breadth exceeds 500, and each template costs ten nodes.

## Environment Variables

The following environment variables are required:

| Variable | Description |
|----------|-------------|
| `RAILWAY_API_TOKEN` | Railway API authentication token |
| `RAILWAY_CUSTOMER_ID` | Your Railway customer UUID |
| `RAILWAY_WORKSPACE_ID` | Your Railway workspace UUID |
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgres://user:pass@host:5432/db`) |

## Setup

To install dependencies:

```bash
bun install
```

## Running

To run the collection process once:

```bash
bun run start
```

## Testing

### Local Database Setup

You can use the `docker-compose.yml` in the root of the repository to start a local PostgreSQL database:

```bash
docker compose up -d postgres
```

### Running Tests

To run the test suite:

```bash
# Ensure TEST_DATABASE_URL is set or use default (postgres://postgres:postgres@localhost:5432/gauge)
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/gauge bun test
```
