# Railway Template Metrics System

**Automated metrics collection and analytics for Railway template businesses.**

A production-ready system that collects, stores, and visualizes Railway template performance metrics to help you make data-driven business decisions. Track revenue trends, identify high-performing templates, monitor health alerts, and optimize your template portfolio.

## 🎯 What This System Does

- **Automated Data Collection**: Fetches earnings and template metrics from Railway's GraphQL API via cron schedule
- **Self-Contained**: Single script handles env validation, schema setup, API calls, and data persistence
- **Cost-Efficient**: Runs on Railway cron triggers - pay only for execution time (typically $0/month)
- **Time-Series Storage**: Stores historical snapshots in PostgreSQL for trend analysis
- **Advanced Analytics**: Calculates retention rates, growth momentum, revenue per active project, and profitability scores
- **Grafana Dashboards**: Beautiful, pre-configured dashboards for business intelligence
- **Health Monitoring**: Alerts for declining templates and revenue risks
- **Fast Package Management**: Uses UV for lightning-fast dependency installation

## 📊 Key Metrics Tracked

### Revenue Metrics

- Template earnings (lifetime and 30-day)
- Revenue growth rates (24h, 7d, 30d)
- Revenue per active project
- Available balance and withdrawals

### Template Health

- Active project retention rate
- Health scores (affects payout percentage)
- Growth momentum
- Recent deployment velocity

### Portfolio Analysis

- Category performance comparison
- Revenue concentration risk
- Profitability scores
- Template rankings

## 🚀 Quick Start

### 1. Prerequisites

Gather these from your Railway account:

- Railway API token ([Get one here](https://railway.app/account/tokens))
- Your Customer ID (UUID)
- Your Workspace ID (UUID)

### 2. Deploy to Railway

```bash
# Clone this repository
git clone <your-repo-url>
cd railway-template-metrics

# Deploy PostgreSQL database
railway add --database postgresql

# Set environment variables in Railway dashboard:
# - RAILWAY_API_TOKEN
# - RAILWAY_CUSTOMER_ID
# - RAILWAY_WORKSPACE_ID
# (DATABASE_URL is automatically set by Railway)

# Deploy the service
railway up

# Set up cron schedule in Railway dashboard:
# Settings → Cron → Add Schedule: "0 */12 * * *"
```

### 3. Verify It's Working

```bash
# Run a test collection (the script handles database setup automatically)
railway run python collect_metrics.py

# Check the database
railway run psql -c "SELECT COUNT(*) FROM template_snapshots;"
```

### 4. Set Up Grafana (Optional)

Deploy Grafana from Railway's template marketplace and configure dashboards using the queries in `DASHBOARD_PLANS.md`.

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - ⚡ 10-minute setup guide (start here!)
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide for Railway
- **[DASHBOARD_PLANS.md](DASHBOARD_PLANS.md)** - Grafana dashboard configurations and SQL queries
- **[schema.sql](schema.sql)** - PostgreSQL database schema with views and functions
- **[.env.example](.env.example)** - Required environment variables

## 🗂️ Project Structure

```
railway-template-metrics/
├── collect_metrics.py      # All-in-one collection script (validates, creates schema, fetches, persists)
├── schema.sql              # PostgreSQL schema definition
├── requirements.txt        # Python dependencies (pip-compatible)
├── pyproject.toml          # UV package management configuration
├── Procfile                # Railway deployment config
├── nixpacks.toml          # Nixpacks build configuration (uses UV)
├── .env.example           # Environment variable template
├── .gitignore             # Git ignore rules
├── README.md              # This file
├── QUICKSTART.md          # Quick start guide (Railway cron setup)
├── DEPLOYMENT.md          # Detailed deployment guide
└── DASHBOARD_PLANS.md     # Grafana dashboard documentation
```

## 💡 Business Insights You'll Get

### Executive Summary Dashboard

- Current month revenue and trends
- Top 5 earning templates
- Revenue concentration risk analysis
- Health alerts for at-risk templates

### Template Performance Dashboard

- Individual template deep-dives
- Retention and growth metrics
- Revenue per active project
- Comparative performance rankings

### Category Analysis Dashboard

- Revenue by template category
- Category growth trends
- Portfolio diversification insights
- Strategic investment recommendations

### Alerts Dashboard

- Templates with low health scores (<70)
- Declining active projects
- Stagnant templates (zero recent deployments)
- Revenue drop alerts

## 🔧 Technical Architecture

```
┌─────────────────────┐
│  Railway GraphQL API│
└──────────┬──────────┘
           │ Every 12 hours
           ▼
┌─────────────────────┐
│ Python Collection   │
│ Script (Cron)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  PostgreSQL DB      │
│  - earnings_snapshots
│  - template_snapshots
│  - derived_metrics  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Grafana Dashboards │
│  - Executive view   │
│  - Template analysis│
│  - Category insights│
└─────────────────────┘
```

## 📈 Sample Insights

After 30 days of data collection, you'll be able to answer:

- Which templates generate the most revenue?
- Which templates have the best retention rates?
- Are my templates growing or declining?
- Which category should I invest in next?
- Am I too dependent on a few high-earning templates?
- Which templates need immediate attention?
- What's my projected revenue for next month?

## 🛠️ Advanced Usage

### Manual Data Collection

```bash
python collect_metrics.py
```

### Query the Database

```bash
railway run psql
```

```sql
-- Top earning templates
SELECT * FROM top_revenue_templates LIMIT 10;

-- Templates needing attention
SELECT * FROM template_health_alerts;

-- Latest earnings summary
SELECT * FROM latest_earnings;
```

### Custom Analytics

The database includes pre-built views and a profitability scoring function. See `schema.sql` for details on creating custom queries.

## 🔒 Security

- All API tokens are stored as environment variables
- Database connections use SSL
- No sensitive data is committed to git
- Follow the security best practices in `DEPLOYMENT.md`

## 💰 Cost

Running on Railway's free tier:

- PostgreSQL: Free tier (512 MB RAM, 1 GB disk)
- Metrics collector: Minimal resources (~50 MB RAM)
- Total: **$0/month** for most users

See `DEPLOYMENT.md` for scaling recommendations if you exceed free tier limits.

## 🤝 Contributing

This is a personal business intelligence tool, but feel free to fork and adapt for your own use case.

## 📝 License

MIT License - See LICENSE file for details

---

## Original API Documentation

## Metrics to collect

### Overall earnings metrics

This can be done using the GraphQL API with the following query:

```graphql
query withdrawalData($customerId: String!) {
  earningDetails(customerId: $customerId) {
    ...EarningDetails
  }
  withdrawalAccountsV2(customerId: $customerId) {
    ...WithdrawalAccountInfo
  }
  hasRecentWithdrawal(customerId: $customerId)
}

fragment EarningDetails on EarningDetails {
  lifetimeEarnings
  referralEarningsLifetime
  referralEarnings30d
  templateEarningsLifetime
  templateEarnings30d
  bountyEarningsLifetime
  bountyEarnings30d
  threadEarningsLifetime
  threadEarnings30d
  availableBalance
  lifetimeCashWithdrawals
  lifetimeCreditWithdrawals
}

fragment WithdrawalAccountInfo on WithdrawalAccount {
  id
  platform
  platformDetails
  customerId
  stripeConnectInfo {
    hasOnboarded
    needsAttention
    bankLast4
    cardLast4
  }
}
```

where customer ID is my customer ID.

Here's an example query body:

`POST https://backboard.railway.com/graphql/internal`

```json
{
    "query": {}, // ...query above, 
    "variables": {
        "customerId" "my-uuid"
    },
    "operationName": "withdrawlData"
}
```

Form this, I can get a lot of earning information that would be useful to track over time. All cash values are stored as integers where the last to places replresent the decimal. For example the number `1408500` represents $14,085.00`

### Individual Template Metrics

These metrics will be useful for tracking the performance of each of my templates individually, and making sure that I can make data driven decisions on what works / doesn't work for template categories. What's growing, what isn't growing over time, etc.

You can fetch this with another GraphQL Query:

```graphql
query workspaceTemplates($workspaceId: String!) {
  workspaceTemplates(workspaceId: $workspaceId) {
    edges {
      node {
        ...UserTemplateFields
      }
    }
  }
}

fragment UserTemplateFields on Template {
  ...TemplateFields
  activeProjects
  totalPayout
}

fragment TemplateFields on Template {
  ...TemplateMetadataFields
  id
  code
  createdAt
  demoProjectId
  workspaceId
  serializedConfig
  canvasConfig
  status
  isApproved
  isVerified
  communityThreadSlug
  isV2Template
  health
  projects
  recentProjects
}

fragment TemplateMetadataFields on Template {
  name
  description
  image
  category
  readme
  tags
  languages
  guides {
    post
    video
  }
}
```

where workspaceId is my workspace ID

Here's an example query body:

`POST https://backboard.railway.com/graphql/internal`

```json
{
    "query": {}, // ...query above, 
    "variables": {
        "workspaceId" "my-workspace-uuid"
    },
    "operationName": "workspaceTemplates"
}
```

This returns some info I don't care about but lots I do. Namely:

- health: this reports on the health of the project. A low health means reduced payout % from 25% to 15%
- projects: total number of projects created from this template since it's release
- activeProjects: current number of projects using the services deployed by this template
- recentProjects: number of projects recently created with this template (good sign of template health / growth curve)
- totalPayout: the current total commision made from this template via template kickbacks

You can get some great metrics with this data:

- activeProjects / projects: gives you a total percentage of retention
- recentProjects / activeProjects: gives you a good relative growth curve; could also compare recentprojects to a previously collected recent projects maybe?
- totalPayout over time lets me track how much my templates are paying out / at what rate they're growing. Measuring this over time will be huge in showing momentum.
