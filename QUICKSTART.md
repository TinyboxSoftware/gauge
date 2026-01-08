# Quick Start Guide

Get your Railway Template Metrics system up and running in 10 minutes.

## Prerequisites

1. **Railway Account** with template earnings
2. **Railway API Token** - [Create one here](https://railway.app/account/tokens)
3. **Your IDs**:
   - Customer ID (UUID)
   - Workspace ID (UUID)

### Finding Your IDs

**Customer ID:**
1. Open Railway dashboard in browser
2. Open DevTools (F12) → Network tab
3. Look for GraphQL requests
4. Find `customerId` in request payload

**Workspace ID:**
1. Go to your workspace in Railway
2. Check the URL or workspace settings
3. Copy the UUID

## Installation Steps

### 1. Clone and Setup

```bash
git clone <your-repo>
cd railway-template-metrics

# Install dependencies locally (for testing)
pip install -r requirements.txt
```

### 2. Configure Credentials

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your actual values
nano .env
```

Add your credentials:
```
RAILWAY_API_TOKEN=your_token_here
RAILWAY_CUSTOMER_ID=your_customer_uuid
RAILWAY_WORKSPACE_ID=your_workspace_uuid
DATABASE_URL=postgresql://localhost:5432/railway_metrics  # For local testing
```

### 3. Test Your Credentials

```bash
# Load environment variables
source .env  # On macOS/Linux
# or
set -a; source .env; set +a  # Alternative

# Test credentials
python test_credentials.py
```

You should see:
```
✅ API token valid! Authenticated as: Your Name
✅ Customer ID valid!
   Lifetime earnings: $14,085.00
   Template earnings: $12,500.00
✅ Workspace ID valid!
   Found 15 templates
```

### 4. Deploy to Railway

#### Option A: Using Railway CLI (Recommended)

```bash
# Login to Railway
railway login

# Create a new project (or link existing)
railway init

# Add PostgreSQL database
railway add --database postgresql

# Set environment variables in Railway dashboard
# Go to: railway.app → Your Project → Variables
# Add:
#   RAILWAY_API_TOKEN
#   RAILWAY_CUSTOMER_ID
#   RAILWAY_WORKSPACE_ID
# (DATABASE_URL is set automatically)

# Initialize database schema
railway run python setup_database.py

# Test collection
railway run python collect_metrics.py

# Deploy the service
railway up
```

#### Option B: Using Railway Dashboard

1. Go to [railway.app](https://railway.app)
2. Create new project
3. Connect your GitHub repository
4. Add PostgreSQL database
5. Add environment variables
6. Deploy!

### 5. Verify It's Working

```bash
# Check logs
railway logs --follow

# Query database
railway run psql
```

In psql:
```sql
-- Check earnings data
SELECT * FROM latest_earnings;

-- Check templates
SELECT template_name, active_projects, total_payout / 100.0 as revenue_usd
FROM latest_template_metrics
ORDER BY total_payout DESC
LIMIT 10;
```

## Next Steps

### Set Up Cron Schedule

The service runs continuously with a 12-hour sleep cycle (via Procfile).

To change the frequency:
1. Edit `Procfile`
2. Change `sleep 43200` to your desired seconds:
   - 6 hours: `21600`
   - 12 hours: `43200`
   - 24 hours: `86400`

### Deploy Grafana

1. In Railway, add a new service
2. Search for "Grafana" template
3. Deploy
4. Configure PostgreSQL data source:
   - Host: Your Railway Postgres internal URL
   - Database: `railway`
   - User: `postgres`
   - Password: From `DATABASE_URL`
   - SSL: Required
5. Create dashboards using queries from `DASHBOARD_PLANS.md`

### Set Up Alerts (Optional)

In Grafana, configure alerts for:
- Templates with health < 60
- Revenue drops > 20% in 7 days
- Templates with 0 recent projects

## Troubleshooting

### "Missing environment variables"
- Run `railway variables` to check they're set
- Verify spelling matches exactly: `RAILWAY_API_TOKEN`, not `RAILWAY_TOKEN`

### "Failed to connect to database"
- Ensure PostgreSQL service is running
- Check `DATABASE_URL` is set
- Verify services are in the same Railway project

### "GraphQL errors"
- Token expired: Generate new one
- Wrong IDs: Double-check Customer ID and Workspace ID
- Test with `python test_credentials.py`

### Collection runs but no data
- Check logs: `railway logs`
- Verify database schema: `railway run psql -c "\dt"`
- Ensure you have templates in your workspace

## Useful Commands

```bash
# Test locally (with .env file)
source .env && python collect_metrics.py

# View Railway logs
railway logs --follow

# Access database
railway run psql

# Check service status
railway status

# Manual collection
railway run python collect_metrics.py

# Database backup
railway run pg_dump > backup.sql

# Check database size
railway run psql -c "SELECT pg_size_pretty(pg_database_size('railway'));"
```

## Data Collection Timeline

- **First run**: Collects current snapshot
- **After 24 hours**: Can calculate 24h growth metrics
- **After 7 days**: Can calculate weekly trends
- **After 30 days**: Full analytics available

## Cost Estimate

Railway Free Tier:
- PostgreSQL: ✅ Free (up to 1 GB)
- Collection Service: ✅ Free (minimal resources)
- Grafana: ⚠️ May require paid plan (~512 MB RAM)

**Total: $0-5/month** depending on Grafana usage

## Support

- **Railway Platform**: https://railway.app/help
- **Documentation**: See `DEPLOYMENT.md` and `DASHBOARD_PLANS.md`
- **Database Schema**: See `schema.sql`

## What's Next?

After 48 hours of data collection:

1. **Review Executive Dashboard** - See overall revenue trends
2. **Analyze Template Performance** - Identify winners and losers
3. **Check Health Alerts** - Address declining templates
4. **Make Data-Driven Decisions** - Invest in high-performing categories

Happy analyzing! 📊
