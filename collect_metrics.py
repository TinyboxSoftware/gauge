#!/usr/bin/env python3
"""
Railway Template Metrics Collector

This script collects metrics from Railway's GraphQL API and stores them in PostgreSQL.
Designed to run on a cron schedule (every 12 hours recommended).
"""

import os
import sys
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import requests
import psycopg2
from psycopg2.extras import execute_values
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class RailwayAPIClient:
    """Client for interacting with Railway's GraphQL API"""

    def __init__(self, api_token: str):
        self.api_token = api_token
        self.endpoint = "https://backboard.railway.com/graphql/internal"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

    def execute_query(self, query: str, variables: Dict[str, Any], operation_name: str) -> Optional[Dict]:
        """Execute a GraphQL query"""
        payload = {
            "query": query,
            "variables": variables,
            "operationName": operation_name
        }

        try:
            response = requests.post(
                self.endpoint,
                json=payload,
                headers=self.headers,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()

            if "errors" in data:
                logger.error(f"GraphQL errors: {data['errors']}")
                return None

            return data.get("data")

        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            return None

    def get_earnings_data(self, customer_id: str) -> Optional[Dict]:
        """Fetch earnings data for a customer"""
        query = """
        query withdrawalData($customerId: String!) {
          earningDetails(customerId: $customerId) {
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
        }
        """

        variables = {"customerId": customer_id}
        data = self.execute_query(query, variables, "withdrawalData")

        if data and "earningDetails" in data:
            return data["earningDetails"]

        return None

    def get_workspace_templates(self, workspace_id: str) -> Optional[List[Dict]]:
        """Fetch all templates for a workspace"""
        query = """
        query workspaceTemplates($workspaceId: String!) {
          workspaceTemplates(workspaceId: $workspaceId) {
            edges {
              node {
                id
                code
                createdAt
                name
                description
                image
                category
                tags
                languages
                status
                isApproved
                isVerified
                health
                projects
                activeProjects
                recentProjects
                totalPayout
              }
            }
          }
        }
        """

        variables = {"workspaceId": workspace_id}
        data = self.execute_query(query, variables, "workspaceTemplates")

        if data and "workspaceTemplates" in data:
            edges = data["workspaceTemplates"].get("edges", [])
            return [edge["node"] for edge in edges]

        return None


class MetricsDatabase:
    """Database handler for storing metrics"""

    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.conn = None

    def connect(self):
        """Establish database connection"""
        try:
            self.conn = psycopg2.connect(self.connection_string)
            logger.info("Database connection established")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")

    def insert_earnings_snapshot(self, earnings_data: Dict, collected_at: datetime) -> bool:
        """Insert earnings snapshot into database"""
        try:
            with self.conn.cursor() as cursor:
                query = """
                INSERT INTO earnings_snapshots (
                    collected_at,
                    lifetime_earnings,
                    lifetime_cash_withdrawals,
                    lifetime_credit_withdrawals,
                    available_balance,
                    template_earnings_lifetime,
                    template_earnings_30d,
                    referral_earnings_lifetime,
                    referral_earnings_30d,
                    bounty_earnings_lifetime,
                    bounty_earnings_30d,
                    thread_earnings_lifetime,
                    thread_earnings_30d
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """

                cursor.execute(query, (
                    collected_at,
                    earnings_data.get("lifetimeEarnings", 0),
                    earnings_data.get("lifetimeCashWithdrawals", 0),
                    earnings_data.get("lifetimeCreditWithdrawals", 0),
                    earnings_data.get("availableBalance", 0),
                    earnings_data.get("templateEarningsLifetime", 0),
                    earnings_data.get("templateEarnings30d", 0),
                    earnings_data.get("referralEarningsLifetime", 0),
                    earnings_data.get("referralEarnings30d", 0),
                    earnings_data.get("bountyEarningsLifetime", 0),
                    earnings_data.get("bountyEarnings30d", 0),
                    earnings_data.get("threadEarningsLifetime", 0),
                    earnings_data.get("threadEarnings30d", 0)
                ))

                self.conn.commit()
                logger.info("Earnings snapshot inserted successfully")
                return True

        except Exception as e:
            logger.error(f"Failed to insert earnings snapshot: {e}")
            self.conn.rollback()
            return False

    def insert_template_snapshots(self, templates: List[Dict], collected_at: datetime) -> bool:
        """Insert template snapshots into database"""
        try:
            with self.conn.cursor() as cursor:
                # Prepare data with calculated metrics
                template_data = []
                for template in templates:
                    # Calculate derived metrics
                    projects = template.get("projects", 0)
                    active_projects = template.get("activeProjects", 0)
                    recent_projects = template.get("recentProjects", 0)
                    total_payout = template.get("totalPayout", 0)

                    # Retention rate: (active / total) * 100
                    retention_rate = (active_projects / projects * 100) if projects > 0 else 0

                    # Revenue per active project
                    revenue_per_active = (total_payout // active_projects) if active_projects > 0 else 0

                    # Growth momentum: (recent / active) * 100
                    growth_momentum = (recent_projects / active_projects * 100) if active_projects > 0 else 0

                    template_data.append((
                        collected_at,
                        template.get("id"),
                        template.get("code"),
                        template.get("name"),
                        template.get("description"),
                        template.get("category"),
                        json.dumps(template.get("tags", [])),
                        json.dumps(template.get("languages", [])),
                        template.get("image"),
                        template.get("status"),
                        template.get("isApproved"),
                        template.get("isVerified"),
                        template.get("health"),
                        projects,
                        active_projects,
                        recent_projects,
                        total_payout,
                        round(retention_rate, 2),
                        revenue_per_active,
                        round(growth_momentum, 2)
                    ))

                query = """
                INSERT INTO template_snapshots (
                    collected_at,
                    template_id,
                    template_code,
                    template_name,
                    description,
                    category,
                    tags,
                    languages,
                    image,
                    status,
                    is_approved,
                    is_verified,
                    health,
                    projects,
                    active_projects,
                    recent_projects,
                    total_payout,
                    retention_rate,
                    revenue_per_active,
                    growth_momentum
                ) VALUES %s
                ON CONFLICT (collected_at, template_id) DO NOTHING
                """

                execute_values(cursor, query, template_data)
                self.conn.commit()
                logger.info(f"Inserted {len(template_data)} template snapshots")
                return True

        except Exception as e:
            logger.error(f"Failed to insert template snapshots: {e}")
            self.conn.rollback()
            return False

    def calculate_derived_metrics(self, collected_at: datetime) -> bool:
        """Calculate and store derived metrics (growth rates, profitability scores)"""
        try:
            with self.conn.cursor() as cursor:
                # This function calculates metrics by comparing current snapshot to historical data
                query = """
                INSERT INTO template_metrics_derived (
                    calculated_at,
                    template_id,
                    template_name,
                    revenue_growth_24h,
                    revenue_growth_7d,
                    revenue_growth_30d,
                    active_projects_change_24h,
                    active_projects_change_7d,
                    active_projects_change_30d,
                    avg_daily_revenue_7d,
                    avg_daily_revenue_30d,
                    profitability_score
                )
                SELECT
                    %s as calculated_at,
                    current.template_id,
                    current.template_name,
                    current.total_payout - COALESCE(prev_24h.total_payout, current.total_payout) as revenue_growth_24h,
                    current.total_payout - COALESCE(prev_7d.total_payout, current.total_payout) as revenue_growth_7d,
                    current.total_payout - COALESCE(prev_30d.total_payout, current.total_payout) as revenue_growth_30d,
                    current.active_projects - COALESCE(prev_24h.active_projects, current.active_projects) as active_change_24h,
                    current.active_projects - COALESCE(prev_7d.active_projects, current.active_projects) as active_change_7d,
                    current.active_projects - COALESCE(prev_30d.active_projects, current.active_projects) as active_change_30d,
                    CASE
                        WHEN prev_7d.total_payout IS NOT NULL
                        THEN (current.total_payout - prev_7d.total_payout) / 7
                        ELSE 0
                    END as avg_daily_revenue_7d,
                    CASE
                        WHEN prev_30d.total_payout IS NOT NULL
                        THEN (current.total_payout - prev_30d.total_payout) / 30
                        ELSE 0
                    END as avg_daily_revenue_30d,
                    calculate_profitability_score(
                        current.total_payout,
                        current.total_payout - COALESCE(prev_30d.total_payout, current.total_payout),
                        current.retention_rate,
                        current.health
                    ) as profitability_score
                FROM
                    template_snapshots current
                LEFT JOIN LATERAL (
                    SELECT total_payout, active_projects
                    FROM template_snapshots
                    WHERE template_id = current.template_id
                        AND collected_at >= %s - INTERVAL '24 hours'
                        AND collected_at < %s
                    ORDER BY collected_at DESC
                    LIMIT 1
                ) prev_24h ON true
                LEFT JOIN LATERAL (
                    SELECT total_payout, active_projects
                    FROM template_snapshots
                    WHERE template_id = current.template_id
                        AND collected_at >= %s - INTERVAL '7 days'
                        AND collected_at < %s
                    ORDER BY collected_at DESC
                    LIMIT 1
                ) prev_7d ON true
                LEFT JOIN LATERAL (
                    SELECT total_payout, active_projects
                    FROM template_snapshots
                    WHERE template_id = current.template_id
                        AND collected_at >= %s - INTERVAL '30 days'
                        AND collected_at < %s
                    ORDER BY collected_at DESC
                    LIMIT 1
                ) prev_30d ON true
                WHERE current.collected_at = %s
                """

                cursor.execute(query, (
                    collected_at,
                    collected_at, collected_at,
                    collected_at, collected_at,
                    collected_at, collected_at,
                    collected_at
                ))

                self.conn.commit()
                logger.info("Derived metrics calculated and stored")
                return True

        except Exception as e:
            logger.error(f"Failed to calculate derived metrics: {e}")
            self.conn.rollback()
            return False


def main():
    """Main execution function"""
    logger.info("Starting Railway Template Metrics Collection")

    # Load environment variables
    railway_api_token = os.getenv("RAILWAY_API_TOKEN")
    customer_id = os.getenv("RAILWAY_CUSTOMER_ID")
    workspace_id = os.getenv("RAILWAY_WORKSPACE_ID")
    database_url = os.getenv("DATABASE_URL")

    # Validate required environment variables
    missing_vars = []
    if not railway_api_token:
        missing_vars.append("RAILWAY_API_TOKEN")
    if not customer_id:
        missing_vars.append("RAILWAY_CUSTOMER_ID")
    if not workspace_id:
        missing_vars.append("RAILWAY_WORKSPACE_ID")
    if not database_url:
        missing_vars.append("DATABASE_URL")

    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        sys.exit(1)

    collected_at = datetime.now(timezone.utc)
    logger.info(f"Collection timestamp: {collected_at.isoformat()}")

    # Initialize API client
    api_client = RailwayAPIClient(railway_api_token)

    # Fetch earnings data
    logger.info("Fetching earnings data...")
    earnings_data = api_client.get_earnings_data(customer_id)
    if not earnings_data:
        logger.error("Failed to fetch earnings data")
        sys.exit(1)

    logger.info(f"Fetched earnings data: ${earnings_data.get('templateEarningsLifetime', 0) / 100:.2f} lifetime")

    # Fetch template data
    logger.info("Fetching template data...")
    templates = api_client.get_workspace_templates(workspace_id)
    if not templates:
        logger.error("Failed to fetch template data")
        sys.exit(1)

    logger.info(f"Fetched {len(templates)} templates")

    # Store data in database
    db = MetricsDatabase(database_url)
    try:
        db.connect()

        # Insert earnings snapshot
        logger.info("Storing earnings snapshot...")
        if not db.insert_earnings_snapshot(earnings_data, collected_at):
            logger.error("Failed to store earnings snapshot")
            sys.exit(1)

        # Insert template snapshots
        logger.info("Storing template snapshots...")
        if not db.insert_template_snapshots(templates, collected_at):
            logger.error("Failed to store template snapshots")
            sys.exit(1)

        # Calculate derived metrics
        logger.info("Calculating derived metrics...")
        if not db.calculate_derived_metrics(collected_at):
            logger.warning("Failed to calculate derived metrics (this is expected on first run)")

        logger.info("✓ Metrics collection completed successfully")

    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
