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

## Local Testing (Optional)

```bash
# Clone repository
git clone <your-repo>
cd railway-template-metrics

# Install UV (faster than pip)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials

# Test the script
python collect_metrics.py
```

## Deploy to Railway

### 1. Create Railway Project

```bash
# Login to Railway
railway login

# Create new project (or link existing)
railway init

# Add PostgreSQL database
railway add --database postgresql
```

### 2. Configure Environment Variables

In Railway dashboard (`railway.app → Your Project → Variables`), add:

```
RAILWAY_API_TOKEN=<your_railway_api_token>
RAILWAY_CUSTOMER_ID=<your_customer_uuid>
RAILWAY_WORKSPACE_ID=<your_workspace_uuid>
```

**Note:** `DATABASE_URL` is automatically set by Railway's PostgreSQL service.

### 3. Set Up Railway Cron Job

The script is designed to run via Railway's **Cron Triggers** for cost efficiency (you only pay for execution time).

**Option A: Using Railway Dashboard (Recommended)**

1. Go to your Railway project
2. Click on your service
3. Go to **Settings** → **Cron**
4. Add a new cron schedule:
   - **Schedule**: `0 */12 * * *` (every 12 hours)
   - **Command**: `python collect_metrics.py`
5. Save

**Option B: Using Railway CLI**

Add to your `railway.json`:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "cronSchedule": "0 */12 * * *"
  }
}
```

### 4. Deploy

```bash
# Deploy to Railway
railway up

# Or connect to GitHub for automatic deployments
# Push to your repository and Railway will auto-deploy
```

### 5. Verify It's Working

```bash
# Trigger a manual run to test
railway run python collect_metrics.py

# Check logs
railway logs

# Query the database
railway run psql -c "SELECT COUNT(*) FROM template_snapshots;"
railway run psql -c "SELECT * FROM latest_earnings;"
```

## Cron Schedule Options

Common cron schedules for metrics collection:

```bash
0 */6 * * *    # Every 6 hours
0 */12 * * *   # Every 12 hours (recommended)
0 0 * * *      # Daily at midnight
0 0 */2 * *    # Every 2 days
0 0 * * 0      # Weekly on Sundays
```

Use [crontab.guru](https://crontab.guru) to create custom schedules.

## What Happens When It Runs

The script automatically:

1. ✅ Validates environment variables
2. ✅ Checks if database schema exists (creates if needed)
3. ✅ Validates Railway API credentials
4. ✅ Fetches earnings & template metrics from Railway
5. ✅ Persists data to PostgreSQL with calculated metrics

**No manual database setup required!** The script handles everything.

## Monitoring

### View Logs

```bash
# Real-time logs
railway logs --follow

# Recent logs
railway logs --lines 100
```

### Query Database

```bash
# Connect to database
railway run psql

# Or run queries directly
railway run psql -c "SELECT * FROM top_revenue_templates LIMIT 10;"
```

### Example Queries

```sql
-- Latest earnings
SELECT
  template_earnings_30d / 100.0 as month_revenue,
  template_earnings_lifetime / 100.0 as lifetime_revenue,
  collected_at
FROM latest_earnings;

-- Top templates
SELECT
  template_name,
  total_payout / 100.0 as revenue_usd,
  active_projects,
  retention_rate
FROM latest_template_metrics
ORDER BY total_payout DESC
LIMIT 10;

-- Health alerts
SELECT * FROM template_health_alerts;
```

## Cost Breakdown

**Railway Free Tier:**
- PostgreSQL: ✅ Free (up to 1 GB)
- Cron execution: ✅ Free (minimal resources)
- **Total: $0/month** for most users

**With Grafana:**
- Add ~$5-10/month if Grafana runs continuously
- Or use Grafana Cloud free tier

## Next Steps

### Set Up Grafana (Optional)

1. Deploy Grafana from Railway marketplace
2. Add PostgreSQL data source
3. Import dashboards from `DASHBOARD_PLANS.md`

### Advanced Usage

- **Custom frequency**: Adjust cron schedule
- **Manual runs**: `railway run python collect_metrics.py`
- **Database backups**: `railway run pg_dump > backup.sql`
- **Custom queries**: See `schema.sql` for available views

## Troubleshooting

### "Missing environment variables"

```bash
railway variables  # Check what's set
railway variables set RAILWAY_API_TOKEN=your_token
```

### "Failed to connect to database"

- Ensure PostgreSQL service is running
- Check `DATABASE_URL` is auto-set by Railway
- Verify services are in same project

### "GraphQL errors"

- Token expired? Generate new one
- Wrong IDs? Double-check Customer ID and Workspace ID
- Test locally first: `python collect_metrics.py`

### Cron not triggering

- Check Railway dashboard for cron configuration
- Verify cron schedule syntax
- Check service deployment status

## Data Timeline

- **First run**: Collects current snapshot, creates database schema
- **After 24 hours**: Can calculate 24h growth metrics
- **After 7 days**: Weekly trend analysis available
- **After 30 days**: Full profitability scoring and trend analysis

## Support

- **Railway Platform**: https://railway.app/help
- **Cron Documentation**: https://docs.railway.app/reference/cron-jobs
- **Database Schema**: See `schema.sql`
- **Dashboard Setup**: See `DASHBOARD_PLANS.md`

---

**Pro Tips:**

1. Run manually first to verify everything works: `railway run python collect_metrics.py`
2. Start with 12-hour collection frequency, adjust as needed
3. Set up Grafana only after you have 48+ hours of data
4. Use Railway's internal network for database connections (faster, free bandwidth)

Happy analyzing! 📊
