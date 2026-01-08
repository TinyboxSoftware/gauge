# Deployment Guide for Railway

This guide walks through deploying the Railway Template Metrics system on Railway.app.

## Architecture Overview

The system consists of three components:

1. **PostgreSQL Database** - Stores all metrics data
2. **Python Cron Service** - Collects metrics every 12 hours
3. **Grafana (Optional)** - Visualizes metrics in dashboards

---

## Prerequisites

Before deploying, gather the following information:

1. **Railway API Token**
   - Go to https://railway.app/account/tokens
   - Create a new token with read permissions
   - Save this token securely

2. **Your Customer ID**
   - Open Railway dashboard in browser
   - Open browser developer tools (F12)
   - Go to Network tab
   - Click on any GraphQL request
   - Look in the request payload for `customerId`
   - Copy the UUID value

3. **Your Workspace ID**
   - In Railway dashboard, go to your workspace
   - Click on workspace settings
   - Copy the workspace ID from the URL or settings
   - Format: UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)

---

## Step 1: Deploy PostgreSQL Database

### Option A: Using Railway Dashboard (Recommended)

1. Create a new project in Railway
2. Click "New" → "Database" → "Add PostgreSQL"
3. Railway will provision a PostgreSQL database
4. Note the connection details (automatically available as `DATABASE_URL`)

### Option B: Using Railway CLI

```bash
railway login
railway init
railway add --database postgresql
```

### Initialize the Database Schema

After PostgreSQL is running:

1. Get your database connection string:
   ```bash
   railway variables --service postgresql
   # Look for DATABASE_URL
   ```

2. Connect to the database and run the schema:
   ```bash
   # Using psql
   psql $DATABASE_URL -f schema.sql

   # Or using Railway's built-in database tools
   railway run psql -f schema.sql
   ```

3. Verify tables were created:
   ```sql
   \dt  -- List all tables
   -- You should see: earnings_snapshots, template_snapshots, template_metrics_derived
   ```

---

## Step 2: Deploy Metrics Collection Service

### Create a Cron Service Configuration

1. Create a `railway.json` file in your repository:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

2. Create a `Procfile` for the cron job:

```
# Run the metrics collection script every 12 hours
worker: while true; do python collect_metrics.py; sleep 43200; done
```

**Note:** 43200 seconds = 12 hours

### Alternative: Using Railway Cron (Recommended)

Create a `nixpacks.toml` file:

```toml
[phases.setup]
nixPkgs = ["python39", "postgresql"]

[phases.install]
cmds = ["pip install -r requirements.txt"]

[start]
cmd = "python collect_metrics.py"
```

Then configure Railway to run this as a cron job:
- In Railway dashboard, go to your service settings
- Under "Deploy Triggers", set up a cron schedule
- Use cron expression: `0 */12 * * *` (every 12 hours)

### Deploy the Service

```bash
# Link your repository to Railway
railway link

# Deploy the service
railway up

# Or push to GitHub (if using GitHub integration)
git push origin main
```

### Configure Environment Variables

In Railway dashboard, add the following environment variables to your service:

```
RAILWAY_API_TOKEN=<your_railway_api_token>
RAILWAY_CUSTOMER_ID=<your_customer_uuid>
RAILWAY_WORKSPACE_ID=<your_workspace_uuid>
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

**Important:** The `DATABASE_URL` should reference your PostgreSQL service using Railway's variable syntax: `${{Postgres.DATABASE_URL}}`. Railway will automatically inject the correct connection string.

---

## Step 3: Test the Collection Script

### Manual Test Run

Before setting up the cron, test the script manually:

```bash
# Using Railway CLI
railway run python collect_metrics.py
```

Expected output:
```
2024-01-08 12:00:00 - __main__ - INFO - Starting Railway Template Metrics Collection
2024-01-08 12:00:00 - __main__ - INFO - Collection timestamp: 2024-01-08T12:00:00+00:00
2024-01-08 12:00:01 - __main__ - INFO - Fetching earnings data...
2024-01-08 12:00:02 - __main__ - INFO - Fetched earnings data: $14085.00 lifetime
2024-01-08 12:00:02 - __main__ - INFO - Fetching template data...
2024-01-08 12:00:03 - __main__ - INFO - Fetched 15 templates
2024-01-08 12:00:03 - __main__ - INFO - Storing earnings snapshot...
2024-01-08 12:00:03 - __main__ - INFO - Earnings snapshot inserted successfully
2024-01-08 12:00:03 - __main__ - INFO - Storing template snapshots...
2024-01-08 12:00:04 - __main__ - INFO - Inserted 15 template snapshots
2024-01-08 12:00:04 - __main__ - INFO - Calculating derived metrics...
2024-01-08 12:00:04 - __main__ - INFO - ✓ Metrics collection completed successfully
```

### Verify Data in Database

```bash
railway run psql
```

```sql
-- Check earnings snapshots
SELECT
  collected_at,
  template_earnings_lifetime / 100.0 as lifetime_usd,
  template_earnings_30d / 100.0 as month_usd
FROM earnings_snapshots
ORDER BY collected_at DESC
LIMIT 5;

-- Check template snapshots
SELECT
  template_name,
  active_projects,
  total_payout / 100.0 as revenue_usd,
  retention_rate,
  health
FROM latest_template_metrics
ORDER BY total_payout DESC
LIMIT 10;

-- Check if derived metrics are calculating
SELECT
  template_name,
  revenue_growth_7d / 100.0 as weekly_growth_usd,
  profitability_score
FROM template_metrics_derived
ORDER BY calculated_at DESC
LIMIT 10;
```

---

## Step 4: Deploy Grafana (Optional)

### Using Railway Template

1. In Railway dashboard, create a new service
2. Search for "Grafana" in the template marketplace
3. Deploy the Grafana template
4. Railway will provision Grafana with persistent storage

### Configure Grafana

1. Access Grafana URL (provided by Railway)
2. Login with default credentials:
   - Username: `admin`
   - Password: Check Railway environment variables for `GF_SECURITY_ADMIN_PASSWORD`

3. Add PostgreSQL data source:
   - Go to Configuration → Data Sources
   - Add PostgreSQL
   - Configure connection:
     - Host: Your Railway PostgreSQL internal hostname
     - Database: `railway` (or your database name)
     - User: `postgres`
     - Password: From `DATABASE_URL`
     - SSL Mode: `require`

4. Import dashboards:
   - Use the queries from `DASHBOARD_PLANS.md`
   - Create dashboards as outlined in the documentation

---

## Step 5: Monitor and Maintain

### View Logs

```bash
# View service logs
railway logs

# Follow logs in real-time
railway logs --follow
```

### Update the Collection Script

```bash
# Make changes to collect_metrics.py
git add collect_metrics.py
git commit -m "Update metrics collection logic"
git push origin main

# Railway will automatically redeploy
```

### Backup Database

Set up automated backups in Railway:

1. Go to PostgreSQL service settings
2. Enable automated backups (available on paid plans)

Or manually backup:

```bash
# Export database
railway run pg_dump > backup_$(date +%Y%m%d).sql

# Restore from backup
railway run psql < backup_20240108.sql
```

---

## Troubleshooting

### Issue: "Missing required environment variables"

**Solution:** Verify all environment variables are set:
```bash
railway variables
```

Ensure you have:
- `RAILWAY_API_TOKEN`
- `RAILWAY_CUSTOMER_ID`
- `RAILWAY_WORKSPACE_ID`
- `DATABASE_URL`

### Issue: "Failed to connect to database"

**Solution:**
1. Check that PostgreSQL service is running
2. Verify `DATABASE_URL` is correctly referencing the Postgres service
3. Ensure the services are in the same Railway project
4. Check network connectivity between services

### Issue: "GraphQL errors" in logs

**Solution:**
1. Verify your Railway API token is valid and has not expired
2. Check that `CUSTOMER_ID` and `WORKSPACE_ID` are correct UUIDs
3. Test the GraphQL queries manually using a tool like Postman:
   - URL: `https://backboard.railway.com/graphql/internal`
   - Headers: `Authorization: Bearer YOUR_TOKEN`
   - Body: Use the queries from the script

### Issue: "Derived metrics not calculating"

**Solution:**
- This is expected on the first run (no historical data to compare)
- After 24+ hours of data collection, derived metrics will populate
- Check the `template_metrics_derived` table after the second collection run

### Issue: Cron job not running on schedule

**Solution:**
1. Check Railway service is deployed and running
2. Verify the Procfile or cron configuration
3. Check service logs for errors
4. Ensure the service didn't crash (check Railway dashboard)

---

## Cost Considerations

### Free Tier Usage

Railway's free tier includes:
- 512 MB RAM
- 1 GB disk
- 100 GB bandwidth

This should be sufficient for:
- Small PostgreSQL database (< 1 GB)
- Metrics collection service (minimal resources)
- Collecting metrics for 10-50 templates

### Scaling Recommendations

If you exceed free tier limits:

1. **Database grows too large:**
   - Archive old snapshots (keep raw data for 90 days)
   - Keep derived metrics indefinitely (smaller storage)
   - Upgrade to paid PostgreSQL plan

2. **Need more frequent collection:**
   - Change cron from 12 hours to 6 hours
   - Monitor for API rate limits from Railway

3. **Adding Grafana:**
   - Grafana requires ~512 MB RAM
   - May need to upgrade to paid plan

---

## Security Best Practices

1. **Rotate API Tokens Regularly:**
   - Update `RAILWAY_API_TOKEN` every 90 days
   - Generate new token in Railway dashboard
   - Update environment variable in Railway service

2. **Database Security:**
   - Never expose `DATABASE_URL` publicly
   - Use Railway's internal network for service-to-service communication
   - Enable SSL mode for database connections

3. **Grafana Security:**
   - Change default admin password immediately
   - Enable HTTPS (Railway provides this automatically)
   - Create read-only users for viewing dashboards
   - Use strong passwords

4. **Environment Variables:**
   - Never commit `.env` file to git
   - Use Railway's environment variable management
   - Keep `.env.example` updated for documentation

---

## Maintenance Schedule

### Daily
- Check Grafana dashboards for alerts
- Review any error logs from collection service

### Weekly
- Review template performance trends
- Identify declining templates
- Check database size

### Monthly
- Review overall revenue trends
- Analyze category performance
- Consider template optimization based on data
- Archive old snapshots if needed

### Quarterly
- Rotate API tokens
- Review and optimize database indexes
- Update profitability score weights if needed
- Export data for long-term analysis

---

## Next Steps

After deployment:

1. ✅ Let the system collect data for 24-48 hours
2. ✅ Verify data is being stored correctly
3. ✅ Set up Grafana dashboards using `DASHBOARD_PLANS.md`
4. ✅ Configure alerts for critical metrics
5. ✅ Share dashboard links with team members
6. ✅ Start making data-driven decisions about templates!

---

## Support

For issues with:
- **Railway platform:** https://railway.app/help
- **This metrics system:** Open an issue in your repository
- **PostgreSQL:** https://www.postgresql.org/docs/
- **Grafana:** https://grafana.com/docs/

## Useful Commands

```bash
# Quick reference for common Railway commands

# View all services in project
railway status

# Open PostgreSQL shell
railway run psql

# View environment variables
railway variables

# Tail logs
railway logs --follow

# Manual metrics collection
railway run python collect_metrics.py

# Database backup
railway run pg_dump > backup.sql

# Check database size
railway run psql -c "SELECT pg_size_pretty(pg_database_size('railway'));"
```
