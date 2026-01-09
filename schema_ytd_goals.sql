-- YTD (Year-to-Date) Income Tracking Schema Extension
-- This extends the existing schema to support annual goal tracking

-- Table: yearly_goals
-- Stores annual revenue goals for YTD tracking
CREATE TABLE IF NOT EXISTS yearly_goals (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,
    goal_amount BIGINT NOT NULL,  -- Goal in cents
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE yearly_goals IS 'Annual revenue goals for YTD tracking and progress monitoring';
COMMENT ON COLUMN yearly_goals.goal_amount IS 'Annual revenue goal in cents (divide by 100 for dollars)';

-- Index for year lookups
CREATE INDEX IF NOT EXISTS idx_yearly_goals_year ON yearly_goals(year DESC);

-- View: ytd_progress
-- Calculates YTD earnings and progress towards goal
CREATE OR REPLACE VIEW ytd_progress AS
WITH year_start_earnings AS (
    -- Get the latest earnings snapshot from the last day of previous year
    -- or the earliest snapshot if no data from previous year
    SELECT
        template_earnings_lifetime as start_earnings,
        EXTRACT(YEAR FROM collected_at) as year
    FROM earnings_snapshots
    WHERE collected_at <= (
        SELECT MIN(collected_at)
        FROM earnings_snapshots
        WHERE EXTRACT(YEAR FROM collected_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    )
    ORDER BY collected_at DESC
    LIMIT 1
),
current_earnings AS (
    -- Get the most recent earnings snapshot
    SELECT
        template_earnings_lifetime as current_earnings,
        collected_at as last_updated
    FROM earnings_snapshots
    ORDER BY collected_at DESC
    LIMIT 1
),
ytd_calc AS (
    SELECT
        EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as year,
        COALESCE(ce.current_earnings - yse.start_earnings, ce.current_earnings) as ytd_earnings,
        ce.current_earnings,
        yse.start_earnings,
        ce.last_updated,
        EXTRACT(DOY FROM CURRENT_DATE) as day_of_year,
        CASE
            WHEN EXTRACT(YEAR FROM CURRENT_DATE) % 4 = 0 AND (EXTRACT(YEAR FROM CURRENT_DATE) % 100 != 0 OR EXTRACT(YEAR FROM CURRENT_DATE) % 400 = 0)
            THEN 366  -- Leap year
            ELSE 365  -- Regular year
        END as days_in_year
    FROM current_earnings ce
    LEFT JOIN year_start_earnings yse ON true
)
SELECT
    ytd.year,
    ytd.ytd_earnings / 100.0 as ytd_earnings_dollars,
    ytd.ytd_earnings,
    COALESCE(yg.goal_amount, 0) as goal_amount,
    COALESCE(yg.goal_amount / 100.0, 0) as goal_dollars,
    -- Progress percentage
    CASE
        WHEN yg.goal_amount > 0
        THEN ROUND((ytd.ytd_earnings::NUMERIC / yg.goal_amount * 100), 2)
        ELSE 0
    END as progress_percentage,
    -- Remaining to goal
    CASE
        WHEN yg.goal_amount > 0
        THEN GREATEST(yg.goal_amount - ytd.ytd_earnings, 0)
        ELSE 0
    END as remaining_to_goal,
    CASE
        WHEN yg.goal_amount > 0
        THEN GREATEST((yg.goal_amount - ytd.ytd_earnings) / 100.0, 0)
        ELSE 0
    END as remaining_to_goal_dollars,
    -- Time-based metrics
    ytd.day_of_year as days_elapsed,
    ytd.days_in_year - ytd.day_of_year as days_remaining,
    ROUND((ytd.day_of_year::NUMERIC / ytd.days_in_year * 100), 2) as year_completion_percentage,
    -- Average daily earnings YTD
    CASE
        WHEN ytd.day_of_year > 0
        THEN ytd.ytd_earnings / ytd.day_of_year
        ELSE 0
    END as avg_daily_earnings,
    CASE
        WHEN ytd.day_of_year > 0
        THEN (ytd.ytd_earnings / ytd.day_of_year) / 100.0
        ELSE 0
    END as avg_daily_earnings_dollars,
    -- Projected year-end earnings at current rate
    CASE
        WHEN ytd.day_of_year > 0
        THEN (ytd.ytd_earnings::NUMERIC / ytd.day_of_year * ytd.days_in_year)::BIGINT
        ELSE 0
    END as projected_year_end,
    CASE
        WHEN ytd.day_of_year > 0
        THEN ((ytd.ytd_earnings::NUMERIC / ytd.day_of_year * ytd.days_in_year) / 100.0)
        ELSE 0
    END as projected_year_end_dollars,
    -- Required daily average to hit goal (remaining amount / remaining days)
    CASE
        WHEN yg.goal_amount > 0 AND (ytd.days_in_year - ytd.day_of_year) > 0
        THEN GREATEST(yg.goal_amount - ytd.ytd_earnings, 0) / (ytd.days_in_year - ytd.day_of_year)
        ELSE 0
    END as required_daily_avg_to_goal,
    CASE
        WHEN yg.goal_amount > 0 AND (ytd.days_in_year - ytd.day_of_year) > 0
        THEN (GREATEST(yg.goal_amount - ytd.ytd_earnings, 0) / (ytd.days_in_year - ytd.day_of_year)) / 100.0
        ELSE 0
    END as required_daily_avg_to_goal_dollars,
    -- On track indicator (compare actual progress vs expected progress based on time)
    CASE
        WHEN yg.goal_amount > 0
        THEN CASE
            WHEN (ytd.ytd_earnings::NUMERIC / yg.goal_amount * 100) >= (ytd.day_of_year::NUMERIC / ytd.days_in_year * 100)
            THEN 'On Track'
            ELSE 'Behind'
        END
        ELSE 'No Goal Set'
    END as pace_status,
    ytd.last_updated,
    yg.notes as goal_notes
FROM ytd_calc ytd
LEFT JOIN yearly_goals yg ON yg.year = ytd.year;

COMMENT ON VIEW ytd_progress IS 'Real-time YTD earnings progress with goal tracking and projections';

-- View: ytd_monthly_breakdown
-- Monthly breakdown of earnings for the current year
CREATE OR REPLACE VIEW ytd_monthly_breakdown AS
WITH daily_earnings AS (
    SELECT
        collected_at::date as date,
        EXTRACT(YEAR FROM collected_at) as year,
        EXTRACT(MONTH FROM collected_at) as month,
        MAX(template_earnings_lifetime) as earnings_at_end_of_day
    FROM earnings_snapshots
    WHERE EXTRACT(YEAR FROM collected_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    GROUP BY collected_at::date
),
monthly_deltas AS (
    SELECT
        year,
        month,
        MIN(date) as month_start,
        MAX(date) as month_end,
        MIN(earnings_at_end_of_day) as month_start_earnings,
        MAX(earnings_at_end_of_day) as month_end_earnings,
        MAX(earnings_at_end_of_day) - MIN(earnings_at_end_of_day) as monthly_earnings
    FROM daily_earnings
    GROUP BY year, month
)
SELECT
    year,
    month,
    TO_CHAR(TO_DATE(month::TEXT, 'MM'), 'Month') as month_name,
    month_start,
    month_end,
    monthly_earnings / 100.0 as monthly_earnings_dollars,
    monthly_earnings,
    SUM(monthly_earnings) OVER (PARTITION BY year ORDER BY month) as cumulative_ytd_earnings,
    SUM(monthly_earnings) OVER (PARTITION BY year ORDER BY month) / 100.0 as cumulative_ytd_dollars
FROM monthly_deltas
ORDER BY year, month;

COMMENT ON VIEW ytd_monthly_breakdown IS 'Monthly earnings breakdown for current year with cumulative YTD totals';

-- View: ytd_goal_history
-- Historical view of goal achievement by year
CREATE OR REPLACE VIEW ytd_goal_history AS
WITH yearly_earnings AS (
    SELECT
        EXTRACT(YEAR FROM collected_at) as year,
        MAX(template_earnings_lifetime) - MIN(template_earnings_lifetime) as year_earnings
    FROM earnings_snapshots
    GROUP BY EXTRACT(YEAR FROM collected_at)
)
SELECT
    ye.year,
    ye.year_earnings / 100.0 as actual_earnings_dollars,
    ye.year_earnings,
    yg.goal_amount,
    yg.goal_amount / 100.0 as goal_dollars,
    CASE
        WHEN yg.goal_amount > 0
        THEN ROUND((ye.year_earnings::NUMERIC / yg.goal_amount * 100), 2)
        ELSE NULL
    END as achievement_percentage,
    CASE
        WHEN yg.goal_amount > 0 AND ye.year_earnings >= yg.goal_amount
        THEN 'Goal Achieved ✓'
        WHEN yg.goal_amount > 0
        THEN 'Goal Not Met'
        ELSE 'No Goal Set'
    END as status,
    yg.notes
FROM yearly_earnings ye
LEFT JOIN yearly_goals yg ON yg.year = ye.year
ORDER BY ye.year DESC;

COMMENT ON VIEW ytd_goal_history IS 'Historical year-over-year goal achievement tracking';

-- Function: upsert_yearly_goal
-- Helper function to set or update yearly goals
CREATE OR REPLACE FUNCTION upsert_yearly_goal(
    p_year INTEGER,
    p_goal_amount BIGINT,
    p_notes TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO yearly_goals (year, goal_amount, notes, updated_at)
    VALUES (p_year, p_goal_amount, p_notes, NOW())
    ON CONFLICT (year)
    DO UPDATE SET
        goal_amount = EXCLUDED.goal_amount,
        notes = EXCLUDED.notes,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_yearly_goal IS 'Insert or update a yearly revenue goal';
