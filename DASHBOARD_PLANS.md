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

## Dashboard 5: YTD Income Tracker

**Purpose:** Track year-to-date income progress against annual goals
**Refresh Rate:** Every 5 minutes
**Target Audience:** Personal goal tracking, annual planning

### Panels

#### Row 1: YTD Overview

1. **YTD Earnings**
   - **Type:** Stat panel (large display)
   - **Query:**
     ```sql
     SELECT ytd_earnings_dollars as value
     FROM ytd_progress
     ```
   - **Display:** Large green number with currency format ($14,523.45)

2. **Annual Goal**
   - **Type:** Stat panel
   - **Query:**
     ```sql
     SELECT goal_dollars as value
     FROM ytd_progress
     ```
   - **Display:** Currency format

3. **Progress to Goal**
   - **Type:** Gauge
   - **Query:**
     ```sql
     SELECT progress_percentage as value
     FROM ytd_progress
     ```
   - **Thresholds:**
     - Red: < 50% (behind pace)
     - Yellow: 50-80% (on pace)
     - Green: 80-100% (ahead)
     - Blue: > 100% (exceeded goal)
   - **Display:** Show percentage with min=0, max=100

4. **Pace Status**
   - **Type:** Stat panel with color coding
   - **Query:**
     ```sql
     SELECT
       pace_status as value,
       CASE pace_status
         WHEN 'On Track' THEN progress_percentage
         WHEN 'Behind' THEN progress_percentage
         ELSE 0
       END as progress
     FROM ytd_progress
     ```
   - **Display:**
     - Green: "On Track"
     - Red: "Behind"
     - Gray: "No Goal Set"

#### Row 2: Progress Visualization

5. **YTD Progress Bar**
   - **Type:** Bar gauge (horizontal)
   - **Query:**
     ```sql
     SELECT
       'Goal Progress' as metric,
       ytd_earnings_dollars as "Earned",
       remaining_to_goal_dollars as "Remaining"
     FROM ytd_progress
     ```
   - **Display:** Stacked horizontal bar showing earned (green) vs remaining (gray)

6. **Time vs Progress**
   - **Type:** Dual stat panel or table
   - **Query:**
     ```sql
     SELECT
       year_completion_percentage as "Year Completed %",
       progress_percentage as "Goal Progress %",
       days_elapsed as "Days Elapsed",
       days_remaining as "Days Remaining"
     FROM ytd_progress
     ```
   - **Purpose:** Compare time elapsed vs progress made

#### Row 3: Rate Metrics

7. **Average Daily Earnings**
   - **Type:** Stat panel with sparkline
   - **Query:**
     ```sql
     SELECT
       avg_daily_earnings_dollars as value
     FROM ytd_progress
     ```
   - **Display:** Currency format ($47.32/day)

8. **Projected Year-End Total**
   - **Type:** Stat panel
   - **Query:**
     ```sql
     SELECT
       projected_year_end_dollars as value
     FROM ytd_progress
     ```
   - **Display:** Currency format
   - **Color:**
     - Green if >= goal
     - Yellow if 80-100% of goal
     - Red if < 80% of goal

9. **Required Daily Average**
   - **Type:** Stat panel
   - **Query:**
     ```sql
     SELECT
       required_daily_avg_to_goal_dollars as value
     FROM ytd_progress
     WHERE progress_percentage < 100
     ```
   - **Display:** Currency format ($52.50/day needed)
   - **Note:** Shows how much you need to earn daily to hit your goal

#### Row 4: Monthly Breakdown

10. **Monthly Earnings (Current Year)**
    - **Type:** Bar chart
    - **Query:**
      ```sql
      SELECT
        month_start as time,
        monthly_earnings_dollars as "Monthly Earnings"
      FROM ytd_monthly_breakdown
      ORDER BY month
      ```
    - **Display:** Bar chart with one bar per month

11. **Cumulative YTD by Month**
    - **Type:** Time series (line + area)
    - **Query:**
      ```sql
      SELECT
        month_end as time,
        cumulative_ytd_dollars as "Cumulative YTD"
      FROM ytd_monthly_breakdown
      ORDER BY month
      ```
    - **Display:** Area chart showing growth over months
    - **Add goal line:**
      ```sql
      SELECT
        month_end as time,
        cumulative_ytd_dollars as "Actual YTD",
        (goal_dollars / 12.0 * month) as "Expected Pace"
      FROM ytd_monthly_breakdown
      CROSS JOIN (SELECT goal_dollars FROM ytd_progress) goal
      ORDER BY month
      ```

#### Row 5: Detailed Stats Table

12. **YTD Summary Table**
    - **Type:** Table
    - **Query:**
      ```sql
      SELECT
        'YTD Earnings' as "Metric",
        '$' || ROUND(ytd_earnings_dollars, 2)::TEXT as "Value"
      FROM ytd_progress
      UNION ALL
      SELECT 'Annual Goal', '$' || ROUND(goal_dollars, 2)::TEXT
      FROM ytd_progress
      UNION ALL
      SELECT 'Remaining to Goal', '$' || ROUND(remaining_to_goal_dollars, 2)::TEXT
      FROM ytd_progress
      WHERE progress_percentage < 100
      UNION ALL
      SELECT 'Progress', ROUND(progress_percentage, 1)::TEXT || '%'
      FROM ytd_progress
      UNION ALL
      SELECT 'Days Elapsed', days_elapsed::TEXT
      FROM ytd_progress
      UNION ALL
      SELECT 'Days Remaining', days_remaining::TEXT
      FROM ytd_progress
      UNION ALL
      SELECT 'Avg Daily (YTD)', '$' || ROUND(avg_daily_earnings_dollars, 2)::TEXT
      FROM ytd_progress
      UNION ALL
      SELECT 'Required Daily Avg', '$' || ROUND(required_daily_avg_to_goal_dollars, 2)::TEXT
      FROM ytd_progress
      WHERE progress_percentage < 100
      UNION ALL
      SELECT 'Projected Year-End', '$' || ROUND(projected_year_end_dollars, 2)::TEXT
      FROM ytd_progress
      UNION ALL
      SELECT 'Pace Status', pace_status
      FROM ytd_progress
      ```
    - **Display:** Two-column table with clean formatting

#### Row 6: Historical View

13. **Year-over-Year Goal Achievement**
    - **Type:** Table
    - **Query:**
      ```sql
      SELECT
        year as "Year",
        '$' || ROUND(actual_earnings_dollars, 2)::TEXT as "Actual Earnings",
        '$' || ROUND(goal_dollars, 2)::TEXT as "Goal",
        ROUND(achievement_percentage, 1)::TEXT || '%' as "Achievement %",
        status as "Status"
      FROM ytd_goal_history
      ORDER BY year DESC
      ```
    - **Display:** Color-coded status column

14. **YTD Comparison: This Year vs Last Year**
    - **Type:** Time series (multi-line)
    - **Query:**
      ```sql
      WITH this_year AS (
        SELECT
          EXTRACT(DOY FROM date) as day_of_year,
          earnings_at_end_of_day
        FROM (
          SELECT
            collected_at::date as date,
            MAX(template_earnings_lifetime) as earnings_at_end_of_day
          FROM earnings_snapshots
          WHERE EXTRACT(YEAR FROM collected_at) = EXTRACT(YEAR FROM CURRENT_DATE)
          GROUP BY collected_at::date
        ) t
      ),
      last_year AS (
        SELECT
          EXTRACT(DOY FROM date) as day_of_year,
          earnings_at_end_of_day
        FROM (
          SELECT
            collected_at::date as date,
            MAX(template_earnings_lifetime) as earnings_at_end_of_day
          FROM earnings_snapshots
          WHERE EXTRACT(YEAR FROM collected_at) = EXTRACT(YEAR FROM CURRENT_DATE) - 1
          GROUP BY collected_at::date
        ) t
      ),
      this_year_normalized AS (
        SELECT
          day_of_year,
          earnings_at_end_of_day - FIRST_VALUE(earnings_at_end_of_day)
            OVER (ORDER BY day_of_year) as ytd_earnings
        FROM this_year
      ),
      last_year_normalized AS (
        SELECT
          day_of_year,
          earnings_at_end_of_day - FIRST_VALUE(earnings_at_end_of_day)
            OVER (ORDER BY day_of_year) as ytd_earnings
        FROM last_year
      )
      SELECT
        ty.day_of_year as "Day of Year",
        ty.ytd_earnings / 100.0 as "This Year YTD",
        ly.ytd_earnings / 100.0 as "Last Year YTD"
      FROM this_year_normalized ty
      FULL OUTER JOIN last_year_normalized ly ON ty.day_of_year = ly.day_of_year
      ORDER BY day_of_year
      ```
    - **Purpose:** Compare YTD performance year-over-year

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
