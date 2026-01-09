# Grafana Dashboard Plans

This document outlines the planned Grafana dashboards for monitoring Railway template metrics and business performance.

## Dashboard Architecture

Grafana will connect directly to PostgreSQL using the built-in PostgreSQL data source. All dashboards will use SQL queries against the database views and tables created in `schema.sql`.

---

## Dashboard 1: Executive Summary

**Purpose:** High-level overview of business health and cash flow
**Refresh Rate:** Every 5 minutes
**Target Audience:** Daily review, strategic decision making

### Panels

#### Row 1: Key Revenue Metrics

1. **Total Template Earnings (30d)**
   - **Type:** Stat panel with trend sparkline
   - **Query:**
     ```sql
     SELECT
       template_earnings_30d / 100.0 as value,
       collected_at
     FROM earnings_snapshots
     ORDER BY collected_at DESC
     LIMIT 1
     ```
   - **Display:** Large font, green if trending up, show delta from previous period

2. **Lifetime Template Earnings**
   - **Type:** Stat panel
   - **Query:**
     ```sql
     SELECT template_earnings_lifetime / 100.0 as value
     FROM latest_earnings
     ```
   - **Display:** Currency format ($14,085.00)

3. **Available Balance**
   - **Type:** Stat panel with gauge
   - **Query:**
     ```sql
     SELECT available_balance / 100.0 as value
     FROM latest_earnings
     ```
   - **Thresholds:**
     - Red: < $500
     - Yellow: $500-$2000
     - Green: > $2000

4. **Template Count**
   - **Type:** Stat panel
   - **Query:**
     ```sql
     SELECT COUNT(DISTINCT template_id) as value
     FROM latest_template_metrics
     WHERE active_projects > 0
     ```

#### Row 2: Revenue Trends

5. **Template Earnings Over Time (30 days)**
   - **Type:** Time series graph
   - **Query:**
     ```sql
     SELECT
       collected_at as time,
       template_earnings_30d / 100.0 as "30-day Earnings",
       template_earnings_lifetime / 100.0 as "Lifetime Earnings"
     FROM earnings_snapshots
     WHERE collected_at >= NOW() - INTERVAL '30 days'
     ORDER BY collected_at
     ```
   - **Display:** Dual-axis line chart

6. **Daily Revenue Growth**
   - **Type:** Bar chart
   - **Query:**
     ```sql
     WITH daily_latest AS (
       SELECT
         collected_at::date as date,
         MAX(template_earnings_lifetime) as earnings
       FROM earnings_snapshots
       WHERE collected_at >= NOW() - INTERVAL '30 days'
       GROUP BY collected_at::date
     ),
     daily_deltas AS (
       SELECT
         date,
         earnings,
         LAG(earnings) OVER (ORDER BY date) as prev_earnings
       FROM daily_latest
     )
     SELECT
       date as time,
       (earnings - prev_earnings) / 100.0 as "Daily Revenue"
     FROM daily_deltas
     WHERE prev_earnings IS NOT NULL
     ORDER BY date
     ```
   - **Note:** This shows daily revenue in dollars. For percentage growth, use:
     ```sql
     WITH daily_latest AS (
       SELECT
         collected_at::date as date,
         MAX(template_earnings_lifetime) as earnings
       FROM earnings_snapshots
       WHERE collected_at >= NOW() - INTERVAL '30 days'
       GROUP BY collected_at::date
     ),
     daily_deltas AS (
       SELECT
         date,
         earnings,
         LAG(earnings) OVER (ORDER BY date) as prev_earnings
       FROM daily_latest
     )
     SELECT
       date as time,
       CASE
         WHEN prev_earnings > 0
         THEN ((earnings - prev_earnings)::float / prev_earnings * 100)
         ELSE 0
       END as "Daily Revenue Growth %"
     FROM daily_deltas
     WHERE prev_earnings IS NOT NULL
     ORDER BY date
     ```

#### Row 3: Top Performers

7. **Top 5 Revenue-Generating Templates**
   - **Type:** Table
   - **Query:**
     ```sql
     SELECT
       template_name as "Template",
       category as "Category",
       total_payout / 100.0 as "Total Revenue",
       active_projects as "Active Projects",
       ROUND(retention_rate, 1) || '%' as "Retention",
       health as "Health"
     FROM top_revenue_templates
     LIMIT 5
     ```
   - **Display:** Color-coded health column (green > 80, yellow 60-80, red < 60)

8. **Revenue Concentration**
   - **Type:** Pie chart
   - **Query:**
     ```sql
     WITH top_templates AS (
       SELECT
         template_name,
         total_payout
       FROM latest_template_metrics
       ORDER BY total_payout DESC
       LIMIT 3
     ),
     total_revenue AS (
       SELECT SUM(total_payout) as total
       FROM latest_template_metrics
     )
     SELECT
       template_name as metric,
       total_payout::float / (SELECT total FROM total_revenue) * 100 as value
     FROM top_templates
     UNION ALL
     SELECT
       'Other' as metric,
       (SELECT total FROM total_revenue - COALESCE(SUM(total_payout), 0))::float /
         (SELECT total FROM total_revenue) * 100 as value
     FROM top_templates
     ```

#### Row 4: Health Alerts

9. **Template Health Alerts**
   - **Type:** Table with conditional formatting
   - **Query:**
     ```sql
     SELECT
       template_name as "Template",
       health as "Health Score",
       active_projects as "Active",
       prev_active_projects as "Previous Active",
       active_change as "Change",
       alert_reason as "Alert"
     FROM template_health_alerts
     ORDER BY health ASC, active_change ASC
     ```
   - **Display:** Red row highlighting for critical issues

---

## Dashboard 2: Template Performance Deep Dive

**Purpose:** Detailed analysis of individual template metrics
**Refresh Rate:** Every 10 minutes
**Target Audience:** Operational review, template optimization

### Panels

#### Row 1: Filters

1. **Template Selector**
   - **Type:** Variable dropdown
   - **Query:**
     ```sql
     SELECT DISTINCT template_name as __text, template_id as __value
     FROM latest_template_metrics
     ORDER BY total_payout DESC
     ```

2. **Category Filter**
   - **Type:** Variable multi-select
   - **Query:**
     ```sql
     SELECT DISTINCT category
     FROM latest_template_metrics
     WHERE category IS NOT NULL
     ```

#### Row 2: Template Overview (Uses $template_id variable)

3. **Template Revenue Trend**
   - **Type:** Time series
   - **Query:**
     ```sql
     SELECT
       collected_at as time,
       total_payout / 100.0 as "Total Revenue"
     FROM template_snapshots
     WHERE template_id = '$template_id'
       AND collected_at >= NOW() - INTERVAL '90 days'
     ORDER BY collected_at
     ```

4. **Active Projects Trend**
   - **Type:** Time series with dual Y-axis
   - **Query:**
     ```sql
     SELECT
       collected_at as time,
       active_projects as "Active Projects",
       projects as "Total Projects"
     FROM template_snapshots
     WHERE template_id = '$template_id'
       AND collected_at >= NOW() - INTERVAL '90 days'
     ORDER BY collected_at
     ```

5. **Retention Rate Over Time**
   - **Type:** Time series
   - **Query:**
     ```sql
     SELECT
       collected_at as time,
       retention_rate as "Retention %"
     FROM template_snapshots
     WHERE template_id = '$template_id'
       AND collected_at >= NOW() - INTERVAL '90 days'
     ORDER BY collected_at
     ```

#### Row 3: Growth Metrics

6. **Revenue Growth Rates**
   - **Type:** Stat panel group (3 panels)
   - **Queries:**
     ```sql
     -- 24h growth
     SELECT revenue_growth_24h / 100.0 as value
     FROM template_metrics_derived
     WHERE template_id = '$template_id'
     ORDER BY calculated_at DESC LIMIT 1

     -- 7d growth
     SELECT revenue_growth_7d / 100.0 as value
     FROM template_metrics_derived
     WHERE template_id = '$template_id'
     ORDER BY calculated_at DESC LIMIT 1

     -- 30d growth
     SELECT revenue_growth_30d / 100.0 as value
     FROM template_metrics_derived
     WHERE template_id = '$template_id'
     ORDER BY calculated_at DESC LIMIT 1
     ```

7. **Growth Momentum Score**
   - **Type:** Gauge
   - **Query:**
     ```sql
     SELECT growth_momentum as value
     FROM latest_template_metrics
     WHERE template_id = '$template_id'
     ```
   - **Thresholds:**
     - Red: < 5% (stagnant)
     - Yellow: 5-10% (moderate)
     - Green: > 10% (strong growth)

#### Row 4: All Templates Comparison

8. **Template Performance Matrix**
   - **Type:** Table with sortable columns
   - **Query:**
     ```sql
     SELECT
       t.template_name as "Template",
       t.category as "Category",
       t.total_payout / 100.0 as "Revenue",
       t.active_projects as "Active",
       ROUND(t.retention_rate, 1) as "Retention %",
       ROUND(t.growth_momentum, 1) as "Growth %",
       t.health as "Health",
       COALESCE(d.revenue_growth_7d / 100.0, 0) as "7d Revenue Δ",
       ROUND(COALESCE(d.profitability_score, 0), 2) as "Score"
     FROM latest_template_metrics t
     LEFT JOIN LATERAL (
       SELECT revenue_growth_7d, profitability_score
       FROM template_metrics_derived
       WHERE template_id = t.template_id
       ORDER BY calculated_at DESC LIMIT 1
     ) d ON true
     WHERE t.active_projects > 0
       AND ($category = '' OR t.category = ANY(string_to_array($category, ',')))
     ORDER BY t.total_payout DESC
     ```
   - **Display:** Conditional formatting on all numeric columns

9. **Template Scatter Plot: Revenue vs Growth**
   - **Type:** Scatter plot (using XY chart)
   - **Query:**
     ```sql
     SELECT
       t.template_name as metric,
       t.total_payout / 100.0 as "Revenue",
       COALESCE(d.revenue_growth_30d / 100.0, 0) as "30d Growth"
     FROM latest_template_metrics t
     LEFT JOIN LATERAL (
       SELECT revenue_growth_30d
       FROM template_metrics_derived
       WHERE template_id = t.template_id
       ORDER BY calculated_at DESC LIMIT 1
     ) d ON true
     WHERE t.active_projects > 0
     ```
   - **Purpose:** Identify high-revenue + high-growth templates (top-right quadrant)

---

## Dashboard 3: Category & Portfolio Analysis

**Purpose:** Strategic analysis across template categories
**Refresh Rate:** Every 15 minutes
**Target Audience:** Strategic planning, market analysis

### Panels

#### Row 1: Category Overview

1. **Revenue by Category**
   - **Type:** Bar chart (horizontal)
   - **Query:**
     ```sql
     SELECT
       COALESCE(category, 'Uncategorized') as category,
       SUM(total_payout) / 100.0 as revenue
     FROM latest_template_metrics
     GROUP BY category
     ORDER BY revenue DESC
     ```

2. **Active Projects by Category**
   - **Type:** Pie chart
   - **Query:**
     ```sql
     SELECT
       COALESCE(category, 'Uncategorized') as metric,
       SUM(active_projects) as value
     FROM latest_template_metrics
     GROUP BY category
     ```

3. **Average Retention by Category**
   - **Type:** Bar gauge
   - **Query:**
     ```sql
     SELECT
       COALESCE(category, 'Uncategorized') as category,
       AVG(retention_rate) as avg_retention
     FROM latest_template_metrics
     GROUP BY category
     ORDER BY avg_retention DESC
     ```

#### Row 2: Category Growth Trends

4. **Category Revenue Trends (30 days)**
   - **Type:** Time series (multi-line)
   - **Query:**
     ```sql
     SELECT
       collected_at as time,
       COALESCE(category, 'Uncategorized') as metric,
       SUM(total_payout) / 100.0 as value
     FROM template_snapshots
     WHERE collected_at >= NOW() - INTERVAL '30 days'
     GROUP BY collected_at, category
     ORDER BY collected_at
     ```

#### Row 3: Portfolio Metrics

5. **Template Distribution**
   - **Type:** Stat panels (3 across)
   - **Queries:**
     ```sql
     -- Total templates
     SELECT COUNT(*) as value FROM latest_template_metrics

     -- Templates with revenue
     SELECT COUNT(*) as value
     FROM latest_template_metrics
     WHERE total_payout > 0

     -- High-health templates (> 80)
     SELECT COUNT(*) as value
     FROM latest_template_metrics
     WHERE health > 80
     ```

6. **Revenue Concentration Risk**
   - **Type:** Stat panel with threshold
   - **Query:**
     ```sql
     WITH top_3_revenue AS (
       SELECT SUM(total_payout) as top_revenue
       FROM (
         SELECT total_payout
         FROM latest_template_metrics
         ORDER BY total_payout DESC
         LIMIT 3
       ) t
     ),
     total_revenue AS (
       SELECT SUM(total_payout) as total
       FROM latest_template_metrics
     )
     SELECT
       (top_revenue::float / total * 100) as value
     FROM top_3_revenue, total_revenue
     ```
   - **Thresholds:**
     - Green: < 60% (diversified)
     - Yellow: 60-80% (moderate risk)
     - Red: > 80% (high concentration risk)

7. **Category Profitability Scores**
   - **Type:** Table
   - **Query:**
     ```sql
     SELECT
       COALESCE(t.category, 'Uncategorized') as "Category",
       COUNT(*) as "Templates",
       SUM(t.active_projects) as "Total Active",
       SUM(t.total_payout) / 100.0 as "Total Revenue",
       ROUND(AVG(t.retention_rate), 1) as "Avg Retention %",
       ROUND(AVG(d.profitability_score), 2) as "Avg Score"
     FROM latest_template_metrics t
     LEFT JOIN LATERAL (
       SELECT profitability_score
       FROM template_metrics_derived
       WHERE template_id = t.template_id
       ORDER BY calculated_at DESC LIMIT 1
     ) d ON true
     GROUP BY t.category
     ORDER BY SUM(t.total_payout) DESC
     ```

---

## Dashboard 4: Alerts & Monitoring

**Purpose:** Real-time health monitoring and anomaly detection
**Refresh Rate:** Every 5 minutes
**Target Audience:** Daily monitoring, quick issue detection

### Panels

1. **Critical Health Alerts**
   - **Type:** Alert list / Table
   - **Query:**
     ```sql
     SELECT
       template_name as "Template",
       health as "Health",
       CASE
         WHEN health < 60 THEN 'CRITICAL'
         WHEN health < 70 THEN 'WARNING'
         ELSE 'OK'
       END as "Severity"
     FROM latest_template_metrics
     WHERE health < 70
     ORDER BY health ASC
     ```

2. **Declining Templates (7-day)**
   - **Type:** Table
   - **Query:**
     ```sql
     SELECT
       t.template_name as "Template",
       t.active_projects as "Current Active",
       d.active_projects_change_7d as "7d Change",
       d.revenue_growth_7d / 100.0 as "7d Revenue Δ"
     FROM latest_template_metrics t
     JOIN LATERAL (
       SELECT active_projects_change_7d, revenue_growth_7d
       FROM template_metrics_derived
       WHERE template_id = t.template_id
       ORDER BY calculated_at DESC LIMIT 1
     ) d ON true
     WHERE d.active_projects_change_7d < 0
        OR d.revenue_growth_7d < 0
     ORDER BY d.revenue_growth_7d ASC
     ```

3. **Zero Recent Projects (Stagnant Templates)**
   - **Type:** Table
   - **Query:**
     ```sql
     SELECT
       template_name as "Template",
       category as "Category",
       active_projects as "Active Projects",
       recent_projects as "Recent Projects",
       health as "Health"
     FROM latest_template_metrics
     WHERE recent_projects = 0
       AND active_projects > 0
     ORDER BY total_payout DESC
     ```

---

## Implementation Notes

### Grafana Setup on Railway

1. **Deploy Grafana:**
   - Use Railway's Grafana template
   - Set persistent storage for dashboard configs

2. **Configure PostgreSQL Data Source:**
   - Host: Use Railway's internal PostgreSQL URL
   - Database: `railway_metrics` (or your database name)
   - SSL Mode: `require`
   - Use connection pooling

3. **Dashboard Variables:**
   - `$template_id`: Template selector
   - `$category`: Category filter
   - `$timerange`: Date range picker (default: 30 days)

4. **Alerting (Optional):**
   - Set up email/Slack alerts for:
     - Templates with health < 60
     - Revenue drops > 20% in 7 days
     - Zero recent projects for high-value templates

### Query Optimization Tips

- All time-series queries should include `collected_at` index
- Use `LIMIT` clauses to prevent large result sets
- Use the pre-built views (`latest_earnings`, `latest_template_metrics`) for point-in-time queries
- Add `WHERE collected_at >= NOW() - INTERVAL 'X days'` to all historical queries

### Refresh Strategy

- **Executive Dashboard:** 5 minutes (business critical)
- **Template Performance:** 10 minutes (operational)
- **Category Analysis:** 15 minutes (strategic)
- **Alerts Dashboard:** 5 minutes (monitoring)

### Color Coding Standards

**Health Scores:**
- 🟢 Green: 80-100
- 🟡 Yellow: 60-79
- 🔴 Red: < 60

**Growth Trends:**
- 🟢 Green: Positive growth
- 🟡 Yellow: Flat (±5%)
- 🔴 Red: Negative growth

**Retention Rates:**
- 🟢 Green: > 40%
- 🟡 Yellow: 20-40%
- 🔴 Red: < 20%

---

## Future Enhancements

1. **Predictive Analytics:**
   - ML model to predict next month's revenue
   - Anomaly detection for unusual patterns

2. **Competitive Benchmarking:**
   - Compare your templates to Railway marketplace averages (if data available)

3. **Custom Reports:**
   - Weekly email summary with key metrics
   - Monthly business review PDF generation

4. **Advanced Profitability Modeling:**
   - Factor in development time/cost per template
   - True ROI calculation per template
