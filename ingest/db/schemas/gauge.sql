-- Railway Template Metrics Database Schema
-- This schema captures earnings and template performance metrics over time

-- Table: earnings_snapshots
-- Stores overall earnings data at each collection interval
CREATE TABLE IF NOT EXISTS earnings_snapshots (
    id SERIAL PRIMARY KEY,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Lifetime earnings
    lifetime_earnings BIGINT NOT NULL,
    lifetime_cash_withdrawals BIGINT NOT NULL,
    lifetime_credit_withdrawals BIGINT NOT NULL,
    available_balance BIGINT NOT NULL,

    -- Template earnings
    template_earnings_lifetime BIGINT NOT NULL,
    template_earnings_30d BIGINT NOT NULL,

    -- Referral earnings
    referral_earnings_lifetime BIGINT NOT NULL,
    referral_earnings_30d BIGINT NOT NULL,

    -- Bounty earnings
    bounty_earnings_lifetime BIGINT NOT NULL,
    bounty_earnings_30d BIGINT NOT NULL,

    -- Thread earnings
    thread_earnings_lifetime BIGINT NOT NULL,
    thread_earnings_30d BIGINT NOT NULL,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_earnings_collected_at ON earnings_snapshots(collected_at DESC);

-- Table: template_snapshots
-- Stores individual template metrics at each collection interval
CREATE TABLE IF NOT EXISTS template_snapshots (
    id SERIAL PRIMARY KEY,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Template identification
    template_id TEXT NOT NULL,
    template_code TEXT,
    template_name TEXT NOT NULL,

    -- Template metadata
    description TEXT,
    category TEXT,
    tags JSONB,
    languages JSONB,
    image TEXT,

    -- Template status
    status TEXT,
    is_approved BOOLEAN,
    is_verified BOOLEAN,
    health INTEGER,

    -- Core metrics
    projects INTEGER NOT NULL,              -- Total projects ever created
    active_projects INTEGER NOT NULL,       -- Currently active projects
    recent_projects INTEGER NOT NULL,       -- Recently created projects
    total_payout BIGINT NOT NULL,          -- Total earnings from this template

    -- Calculated metrics (computed during collection)
    retention_rate NUMERIC(10,2),           -- active_projects / projects * 100
    revenue_per_active BIGINT,             -- total_payout / active_projects (if active > 0)
    growth_momentum NUMERIC(10,2),          -- recent_projects / active_projects * 100 (if active > 0)

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint to ensure we can track templates over time
    UNIQUE(collected_at, template_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_template_collected_at ON template_snapshots(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_id ON template_snapshots(template_id);
CREATE INDEX IF NOT EXISTS idx_template_category ON template_snapshots(category);
CREATE INDEX IF NOT EXISTS idx_template_total_payout ON template_snapshots(total_payout DESC);

-- Table: template_deployment_snapshots
-- Stores per-template deploy counters from the creator-private templateMetrics
-- query. These count deploys, including redeploys of an existing install, and
-- are therefore a different population from template_snapshots.projects, which
-- counts projects created from the template.
CREATE TABLE IF NOT EXISTS template_deployment_snapshots (
    id SERIAL PRIMARY KEY,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Template identification
    template_id TEXT NOT NULL,
    template_code TEXT,
    template_name TEXT NOT NULL,

    -- Deploy counters
    total_deployments INTEGER NOT NULL,
    deployments_last_90d INTEGER NOT NULL,
    active_deployments INTEGER NOT NULL,

    -- Health percentages over Railway's rolling window
    template_health NUMERIC(5,2),
    support_health NUMERIC(5,2),

    -- Earnings, in dollars: templateMetrics reports dollars where
    -- earnings_snapshots reports cents
    total_earnings NUMERIC(12,2),
    earnings_last_30d NUMERIC(12,2),
    earnings_last_90d NUMERIC(12,2),
    eligible_for_support_bonus BOOLEAN,

    -- Failed deploys implied by health, stored so the count is queryable
    -- directly instead of being re-derived in every query
    failed_deployments INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(collected_at, template_id)
);

CREATE INDEX IF NOT EXISTS idx_deployment_collected_at ON template_deployment_snapshots(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_template_id ON template_deployment_snapshots(template_id);
CREATE INDEX IF NOT EXISTS idx_deployment_health ON template_deployment_snapshots(template_health);

-- Table: template_metrics_derived
-- Stores calculated time-series metrics (revenue growth, etc.)
-- This table is populated by comparing snapshots over time
CREATE TABLE IF NOT EXISTS template_metrics_derived (
    id SERIAL PRIMARY KEY,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    template_id TEXT NOT NULL,
    template_name TEXT NOT NULL,

    -- Growth metrics (comparing to previous snapshot)
    revenue_growth_24h BIGINT,             -- Change in total_payout over 24h
    revenue_growth_7d BIGINT,              -- Change in total_payout over 7d
    revenue_growth_30d BIGINT,             -- Change in total_payout over 30d

    active_projects_change_24h INTEGER,    -- Change in active projects
    active_projects_change_7d INTEGER,
    active_projects_change_30d INTEGER,

    -- Velocity metrics
    avg_daily_revenue_7d BIGINT,           -- Average daily revenue over 7d
    avg_daily_revenue_30d BIGINT,          -- Average daily revenue over 30d

    -- Profitability score (composite metric)
    profitability_score NUMERIC(10,2),     -- Weighted score for ranking templates

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_derived_calculated_at ON template_metrics_derived(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_derived_template_id ON template_metrics_derived(template_id);
CREATE INDEX IF NOT EXISTS idx_derived_profitability_score ON template_metrics_derived(profitability_score DESC);

-- View: latest_earnings
-- Quick access to most recent earnings snapshot
CREATE OR REPLACE VIEW latest_earnings AS
SELECT * FROM earnings_snapshots
ORDER BY collected_at DESC
LIMIT 1;

-- View: latest_template_metrics
-- Quick access to most recent metrics for all templates
CREATE OR REPLACE VIEW latest_template_metrics AS
SELECT DISTINCT ON (template_id)
    *
FROM template_snapshots
ORDER BY template_id, collected_at DESC;

-- View: top_revenue_templates
-- Templates ranked by total payout (latest snapshot)
CREATE OR REPLACE VIEW top_revenue_templates AS
SELECT
    template_id,
    template_name,
    category,
    total_payout,
    active_projects,
    retention_rate,
    revenue_per_active,
    health,
    collected_at
FROM latest_template_metrics
ORDER BY total_payout DESC;

-- View: template_health_alerts
-- Templates with health issues (health < 70 or declining active projects)
CREATE OR REPLACE VIEW template_health_alerts AS
WITH latest AS (
    SELECT DISTINCT ON (template_id)
        template_id,
        template_name,
        health,
        active_projects,
        collected_at
    FROM template_snapshots
    ORDER BY template_id, collected_at DESC
),
previous AS (
    SELECT DISTINCT ON (template_id)
        template_id,
        active_projects as prev_active_projects,
        collected_at as prev_collected_at
    FROM template_snapshots
    WHERE collected_at < (SELECT MAX(collected_at) FROM template_snapshots)
    ORDER BY template_id, collected_at DESC
)
SELECT
    l.template_id,
    l.template_name,
    l.health,
    l.active_projects,
    COALESCE(p.prev_active_projects, l.active_projects) as prev_active_projects,
    l.active_projects - COALESCE(p.prev_active_projects, l.active_projects) as active_change,
    CASE
        WHEN l.health < 70 THEN 'Low Health'
        WHEN l.active_projects < COALESCE(p.prev_active_projects, l.active_projects) THEN 'Declining Active Projects'
        ELSE 'Other'
    END as alert_reason
FROM latest l
LEFT JOIN previous p ON l.template_id = p.template_id
WHERE l.health < 70
   OR l.active_projects < COALESCE(p.prev_active_projects, l.active_projects);

-- View: template_deployment_failures
-- Deploys and failures added between consecutive snapshots of a template.
-- health alone cannot answer "how many deploys failed since yesterday": it is a
-- percentage over a rolling window, so it recovers as old failures age out. The
-- deltas here do answer it.
CREATE OR REPLACE VIEW template_deployment_failures AS
SELECT
    curr.collected_at,
    curr.template_id,
    curr.template_name,
    curr.template_health,
    curr.total_deployments,
    curr.failed_deployments,
    curr.total_deployments - prev.total_deployments AS deployments_added,
    curr.failed_deployments - prev.failed_deployments AS failures_added,
    prev.collected_at AS compared_to
FROM template_deployment_snapshots curr
LEFT JOIN LATERAL (
    SELECT total_deployments, failed_deployments, collected_at
    FROM template_deployment_snapshots prev
    WHERE prev.template_id = curr.template_id
      AND prev.collected_at < curr.collected_at
    ORDER BY prev.collected_at DESC
    LIMIT 1
) prev ON true
ORDER BY curr.collected_at DESC, failures_added DESC NULLS LAST;

-- Function: calculate_profitability_score
-- Calculates a composite profitability score for a template
-- Weights: Revenue 40%, Growth 30%, Retention 20%, Health 10%
CREATE OR REPLACE FUNCTION calculate_profitability_score(
    p_total_payout BIGINT,
    p_revenue_growth_30d BIGINT,
    p_retention_rate NUMERIC,
    p_health INTEGER
) RETURNS NUMERIC AS $$
DECLARE
    max_payout BIGINT;
    max_growth BIGINT;
    normalized_revenue NUMERIC;
    normalized_growth NUMERIC;
    normalized_retention NUMERIC;
    normalized_health NUMERIC;
BEGIN
    -- Get max values for normalization
    SELECT MAX(total_payout) INTO max_payout FROM latest_template_metrics;
    SELECT MAX(revenue_growth_30d) INTO max_growth FROM template_metrics_derived;

    -- Normalize values to 0-100 scale
    normalized_revenue := CASE WHEN max_payout > 0 THEN (p_total_payout::NUMERIC / max_payout * 100) ELSE 0 END;
    normalized_growth := CASE WHEN max_growth > 0 THEN (p_revenue_growth_30d::NUMERIC / max_growth * 100) ELSE 0 END;
    normalized_retention := COALESCE(p_retention_rate, 0);
    normalized_health := COALESCE(p_health, 0);

    -- Calculate weighted score
    RETURN (
        (normalized_revenue * 0.40) +
        (normalized_growth * 0.30) +
        (normalized_retention * 0.20) +
        (normalized_health * 0.10)
    );
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE earnings_snapshots IS 'Stores overall earnings data snapshots collected every 12 hours';
COMMENT ON TABLE template_snapshots IS 'Stores individual template performance metrics collected every 12 hours';
COMMENT ON TABLE template_metrics_derived IS 'Stores calculated metrics derived from comparing snapshots over time';
COMMENT ON TABLE template_deployment_snapshots IS 'Stores per-template deploy counters and health from the creator-private templateMetrics query';
COMMENT ON COLUMN template_deployment_snapshots.total_deployments IS 'Deploys of this template, including redeploys of an existing install - not the same population as template_snapshots.projects';
COMMENT ON COLUMN template_deployment_snapshots.failed_deployments IS 'Deploys implied to have failed by health: total_deployments * (100 - template_health) / 100, rounded';
COMMENT ON COLUMN template_snapshots.retention_rate IS 'Percentage of total projects that are still active (active/total * 100)';
COMMENT ON COLUMN template_snapshots.revenue_per_active IS 'Average revenue per active project (total_payout / active_projects)';
COMMENT ON COLUMN template_snapshots.growth_momentum IS 'Recent projects as percentage of active projects (recent/active * 100)';
