# YTD Income Tracking Guide

This guide explains how to use the Year-to-Date (YTD) income tracking system to monitor your progress toward annual revenue goals.

## Overview

The YTD tracking system allows you to:
- Set annual revenue goals
- Track your progress throughout the year
- See if you're on pace to hit your goals
- Calculate required daily earnings to reach targets
- Compare year-over-year performance
- Project year-end earnings based on current rates

## Quick Start

### 1. Install the Schema Extension

First, apply the YTD schema to your database:

```bash
# If using Railway CLI
railway run psql $DATABASE_URL < schema_ytd_goals.sql

# Or using psql directly
psql $DATABASE_URL < schema_ytd_goals.sql
```

This creates:
- `yearly_goals` table for storing your goals
- `ytd_progress` view for real-time progress tracking
- `ytd_monthly_breakdown` view for monthly analysis
- `ytd_goal_history` view for historical comparisons

### 2. Set Your First Goal

Use the `set_goal.py` script to set your annual revenue goal:

```bash
# Set goal for current year (2026)
python set_goal.py --set 50000

# Set goal with notes
python set_goal.py --set 75000 --notes "Stretch goal for new template launches"

# Set goal for a different year
python set_goal.py --set 60000 --year 2027 --notes "Conservative growth target"
```

### 3. View Your Progress

Check your current YTD progress:

```bash
python set_goal.py --progress
```

This shows:
- Current YTD earnings
- Progress percentage toward goal
- Days elapsed and remaining
- Average daily earnings
- Projected year-end total
- Required daily average to hit goal
- Whether you're on track or behind pace

### 4. Set Up Grafana Dashboard

Create a new dashboard in Grafana using the queries from `DASHBOARD_PLANS.md` (Dashboard 5: YTD Income Tracker).

## Understanding the Metrics

### Key Metrics Explained

**YTD Earnings**
- Your total template earnings from January 1st to today
- Calculated by comparing current earnings to year-start baseline

**Progress Percentage**
- Your actual progress toward the annual goal
- Formula: `(YTD Earnings / Annual Goal) * 100`

**Pace Status**
- **On Track**: Your progress % is >= the % of year elapsed
- **Behind**: Your progress % is < the % of year elapsed
- Example: If 25% of the year has passed and you're at 30% of your goal, you're "On Track"

**Average Daily Earnings**
- Your actual average daily earnings so far this year
- Formula: `YTD Earnings / Days Elapsed`

**Projected Year-End Total**
- Where you'll end up if current rate continues
- Formula: `(YTD Earnings / Days Elapsed) * Days in Year`

**Required Daily Average**
- How much you need to earn per day (from today forward) to hit your goal
- Formula: `(Goal - YTD Earnings) / Days Remaining`

## Example Usage Scenarios

### Scenario 1: Setting Your 2026 Goal

```bash
# You want to earn $60,000 from templates in 2026
python set_goal.py --set 60000 --year 2026 --notes "Goal based on 5 active templates"
```

### Scenario 2: Checking Mid-Year Progress

On July 1st (day 183 of 365), you check your progress:

```bash
python set_goal.py --progress
```

Output:
```
📈 YTD Progress for 2026

======================================================================
YTD Earnings:           $28,500.00
Annual Goal:            $60,000.00
Progress:               47.5%

Remaining to Goal:      $31,500.00
Days Elapsed:           183
Days Remaining:         182
Year Completion:        50.1%

Avg Daily Earnings:     $155.74/day
Projected Year-End:     $56,845.00
Required Daily Avg:     $173.08/day

Pace Status:            ⚠ Behind
Last Updated:           2026-07-01 16:00:00
======================================================================
```

**Analysis**: You're slightly behind pace (47.5% progress at 50.1% year completion). You need to increase daily earnings from $155.74 to $173.08 to hit your goal.

### Scenario 3: Updating Your Goal

If circumstances change and you want to adjust:

```bash
# Increase goal to $75,000
python set_goal.py --set 75000 --notes "Updated after launching 2 new high-value templates"
```

The same year's goal will be updated (upserted).

## Dashboard Visualizations

The YTD Dashboard (Dashboard 5 in `DASHBOARD_PLANS.md`) includes:

### Row 1: Overview
- **Big numbers**: YTD earnings, goal, progress percentage
- **Gauge**: Visual progress indicator
- **Status**: On Track / Behind indicator

### Row 2: Visual Progress
- **Progress bar**: Earned vs remaining (stacked bar)
- **Time comparison**: Year completion % vs goal progress %

### Row 3: Rates & Projections
- **Daily average**: What you're earning per day
- **Projection**: Where you'll end up at current rate
- **Required rate**: What you need to earn daily to hit goal

### Row 4: Monthly Breakdown
- **Bar chart**: Earnings by month
- **Cumulative chart**: YTD growth over time with expected pace line

### Row 5: Detailed Table
- All metrics in one place for easy reference

### Row 6: Historical
- **Year-over-year table**: Compare this year to previous years
- **YTD comparison chart**: This year's daily progress vs last year

## Database Schema Details

### yearly_goals Table

```sql
CREATE TABLE yearly_goals (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,
    goal_amount BIGINT NOT NULL,  -- In cents
    notes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### ytd_progress View

This view calculates real-time progress metrics:
- YTD earnings (current - year start)
- Progress percentage
- Days elapsed/remaining
- Averages and projections
- Pace status

### Example Queries

**Check current progress:**
```sql
SELECT * FROM ytd_progress;
```

**Get monthly breakdown:**
```sql
SELECT * FROM ytd_monthly_breakdown;
```

**View goal history:**
```sql
SELECT * FROM ytd_goal_history;
```

**Manually set/update a goal:**
```sql
SELECT upsert_yearly_goal(2026, 5000000, 'Goal is $50k (stored as cents)');
```

## Tips for Success

1. **Set Realistic Goals**
   - Base goals on historical data if available
   - Consider seasonality in your template usage
   - Account for time needed to develop new templates

2. **Review Progress Regularly**
   - Check weekly or bi-weekly
   - Adjust strategy if falling behind
   - Celebrate milestones (25%, 50%, 75%)

3. **Use Projections Wisely**
   - Projections assume current rate continues
   - Consider seasonal variations
   - Factor in planned template launches

4. **Track Monthly Trends**
   - Identify strong/weak months
   - Plan template launches for high-traffic periods
   - Address declining months proactively

5. **Compare Year-over-Year**
   - See if you're improving
   - Identify successful strategies from previous years
   - Set stretch goals based on YoY growth

## Troubleshooting

### "No data available" when checking progress

**Solution**: Run `collect_metrics.py` first to populate earnings data.

```bash
python collect_metrics.py
```

### Schema not found errors

**Solution**: Apply the YTD schema extension:

```bash
psql $DATABASE_URL < schema_ytd_goals.sql
```

### Progress shows 0% but you have earnings

**Solution**: No goal set for current year. Set one:

```bash
python set_goal.py --set 50000
```

### YTD earnings seem incorrect

**Cause**: The system calculates YTD by comparing current earnings to the earliest snapshot from this year. If data collection started mid-year, YTD will only show growth since then.

**Solution**: This is expected behavior. Future years will have accurate full-year tracking.

## Integration with Existing Dashboards

The YTD tracker complements your existing dashboards:

- **Executive Summary**: Add YTD progress stat panels
- **Template Performance**: Compare template revenue to YTD goals
- **Alerts Dashboard**: Add alert for "behind pace" status

Example alert query:
```sql
SELECT
  'Behind Pace' as alert,
  ytd_earnings_dollars as current,
  goal_dollars as target,
  progress_percentage as progress
FROM ytd_progress
WHERE pace_status = 'Behind'
  AND progress_percentage < 90;  -- Alert if <90% with <10% year remaining
```

## Advanced Usage

### Setting Goals for Multiple Years

```bash
# Set goals for next 3 years
python set_goal.py --set 50000 --year 2026
python set_goal.py --set 65000 --year 2027 --notes "30% growth"
python set_goal.py --set 85000 --year 2028 --notes "New product line"
```

### Viewing All Goals

```bash
python set_goal.py --view
```

### API Integration

If you want to set goals programmatically:

```python
import psycopg2

def set_goal_programmatic(year, amount_dollars, notes=None):
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cursor = conn.cursor()

    amount_cents = int(amount_dollars * 100)
    cursor.execute(
        "SELECT upsert_yearly_goal(%s, %s, %s)",
        (year, amount_cents, notes)
    )

    conn.commit()
    cursor.close()
    conn.close()

# Example
set_goal_programmatic(2026, 75000, "Stretch goal")
```

## Support

For issues or questions:
1. Check this documentation
2. Review queries in `DASHBOARD_PLANS.md`
3. Examine the `ytd_progress` view definition in `schema_ytd_goals.sql`

## Future Enhancements

Planned features:
- Goal adjustment recommendations based on seasonal trends
- Milestone notifications (25%, 50%, 75% achieved)
- Template-specific goal breakdowns
- Quarter-based goal tracking
- Historical goal achievement rate analysis
