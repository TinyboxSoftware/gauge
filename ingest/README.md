# ingest

Railway Template Metrics Ingestor. Collects earnings and template metrics from Railway API and persists them to PostgreSQL.

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
