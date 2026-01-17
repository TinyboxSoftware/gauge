# Deploy and Host Gauge on Railway

A complete metrics and analytics stack for Railway Template creators. featuring automated data collection, PostgreSQL persistence, and pre-configured Grafana dashboards to track revenue, health, and growth.

## About Hosting Gauge

Hosting Gauge involves deploying a three-tier observability stack specifically designed for Railway template businesses:

- a Bun-powered ingest service that interacts with the Railway GraphQL API and runs via a CRON service.
- a PostgreSQL database for historical snapshot storage
- a provisioned Grafana instance for professional-grade visualization.

The system automatically handles time-series growth calculations (24h, 7d, 30d) and provides deep insights into template retention and revenue momentum outside of Railway's current metrics.

## Common Use Cases

- **Revenue Performance Tracking:** Monitor lifetime and 30-day earnings across your entire template portfolio.
- **Template Health Monitoring:** Keep track of health scores to ensure you maintain maximum payout percentages (25%).
- **Retention Analysis:** Compare active projects against total deployments to calculate real-world retention rates.
- **Growth Rate Benchmarking:** Identify high-momentum templates using 24-hour, 7-day, and 30-day revenue growth trends.
- **Portfolio Risk Management:** Visualize revenue concentration to understand which templates drive your business.

## Dependencies for Gauge Hosting

- **Railway Volumes:** For persistent PostgreSQL storage of historical metrics.
- **Docker Images:** Pre-configured environments for Bun (Ingest Service) and Grafana (Visualization).

## Deployment Dependencies

- **Railway API Token:** Required to fetch metrics from your account; should be an account level token.
- **Railway Customer & Workspace IDs:** For targeted API queries.
- **Grafana Documentation:** For advanced dashboard customization.
- **Railway GraphQL API:** The source of truth for all ingested data.

## Implementation Details

### Quick Start Guide

#### Deploying Services 

1. Click **"Deploy on Railway"** and provide your Railway API credentials, Customer ID, and Workspace ID in the environment variables.
2. Set your desired Grafana admin username.
3. Wait 2-3 minutes for the services to initialize.

#### Configure Ingest CRON Service

1. Manually configure the ingest service's schedule by going to settings -> Cron Schedule -> Add Schedule
2. I would suggest starting with `0 0,12 * * *` which would be every 12 hours in UTC time 
3. From now on, your ingest will run on a schedule and pull in your Railway Template metrics

#### Access your dashboards via Grafana

1. Grab the automatically generated domain from the Grafana service.
2. Grab your generated password from the Grafna Service -> Variables -> `GF_SECURITY_ADMIN_PASSWORD` and copy it. 
7. Access your **Executive Summary** dashboard via the generated domain and username/password.
8. OPTIONAL: add a custom domain to your Grafana service so it's easier to remember. 

### Environment Variables

#### Ingest Service (Bun)

These variables control the collection and processing of Railway API data.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `RAILWAY_API_TOKEN` | Your Railway personal API token | **Required** |
| `RAILWAY_CUSTOMER_ID` | Your Railway Customer UUID | **Required** |
| `RAILWAY_WORKSPACE_ID` | Your Railway Workspace UUID | **Required** |
| `DATABASE_URL` | PostgreSQL connection string | *Provided by Railway* |

#### Grafana (Visualization)

These variables configure the Grafana instance and its connection to the database.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VERSION` | Grafana version to deploy (from `grafana/dockerfile`) | `latest` default |
| `GF_SECURITY_ADMIN_USER` | Grafana admin username | `admin` |
| `DATABASE_HOST` | Database internal hostname | `${{Postgres.RAILWAY_INTERNAL_HOST}}` |
| `DATABASE_PORT` | Database internal port | `${{Postgres.PORT}}` |
| `DATABASE_USER` | Database username | `${{Postgres.POSTGRES_USER}}` |
| `DATABASE_PASSWORD` | Database password | `${{Postgres.POSTGRES_PASSWORD}}` |
| `DATABASE_NAME` | Database name | `${{Postgres.POSTGRES_DB}}` |

### Internal Service URLs

The stack components communicate internally using these Railway's internal networking

### Version Control

Each service is pinned to stable versions for production reliability:

- **Bun (Ingest):** `latest` (Alpine)
- **PostgreSQL:** Railway's latest supported version (16+)
- **Grafana:** `12.3.1` (Configurable via `VERSION` environment variable)

### Connecting Applications

**For Ingest:** The `ingest` service runs as a scheduled worker (Cron) within the stack. It is pre-configured to connect to the internal PostgreSQL instance using the `DATABASE_URL`.

**For Visualization:** Grafana is auto-provisioned with a datasource named `psql-gauge` pointing to the internal database. No manual setup is required to see your metrics.

**For Data Export:** You can connect external BI tools to the PostgreSQL instance as needed- that data is yours even if you don't want to use Grafana to visualize it.

## Customizing Your Stack

To customize dashboards or collection logic:

1. **Fork the GitHub repository.**
2. Modify the ingest logic in `ingest/index.ts`
3. Update dashboard JSON templates in `grafana/dashboards/templates/` to add custom visualizations.
4. Commit, relink the repo, and push; Railway will automatically redeploy the updated services.

## Why Deploy Gauge on Railway?

Railway is the premier platform for hosting infrastructure. By deploying Gauge on Railway, you get a self-healing, vertically-scaling observability stack that monitors your Railway business from *within* Railway.

Leverage the same platform that hosts your templates to analyze their success, ensuring minimal latency and maximum security for your business data.
