#!/usr/bin/env python3
"""
Railway Template Metrics Collector - All-in-One Script

This script handles the complete metrics collection pipeline:
1. Validates environment variables
2. Ensures database schema exists (creates if needed)
3. Validates Railway API credentials
4. Fetches earnings and template metrics
5. Persists data to PostgreSQL

Designed to run as a Railway cron job for cost efficiency.
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
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


# ============================================================================
# STEP 0: VALIDATE ENVIRONMENT VARIABLES
# ============================================================================

def validate_environment() -> Dict[str, str]:
    """Validate all required environment variables exist"""
    logger.info("=" * 70)
    logger.info("STEP 0: Validating Environment Variables")
    logger.info("=" * 70)

    required_vars = {
        "RAILWAY_API_TOKEN": "Railway API authentication token",
        "RAILWAY_CUSTOMER_ID": "Your Railway customer UUID",
        "RAILWAY_WORKSPACE_ID": "Your Railway workspace UUID",
        "DATABASE_URL": "PostgreSQL connection string"
    }

    config = {}
    missing = []

    for var_name, description in required_vars.items():
        value = os.getenv(var_name)
        if not value:
            missing.append(f"{var_name} ({description})")
        else:
            config[var_name] = value
            # Mask sensitive values in logs
            if "TOKEN" in var_name or "PASSWORD" in var_name:
                display_value = value[:8] + "..." if len(value) > 8 else "***"
            else:
                display_value = value
            logger.info(f"✓ {var_name}: {display_value}")

    if missing:
        logger.error("❌ Missing required environment variables:")
        for var in missing:
            logger.error(f"   - {var}")
        logger.error("\nSet these variables in Railway dashboard or .env file")
        sys.exit(1)

    logger.info("✅ All environment variables validated\n")
    return config


# ============================================================================
# STEP 1: ENSURE DATABASE SCHEMA EXISTS
# ============================================================================

def ensure_database_schema(database_url: str) -> bool:
    """Check if database tables exist, create if not"""
    logger.info("=" * 70)
    logger.info("STEP 1: Ensuring Database Schema Exists")
    logger.info("=" * 70)

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        # Check if main tables exist
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('earnings_snapshots', 'template_snapshots', 'template_metrics_derived')
        """)

        existing_tables = [row[0] for row in cursor.fetchall()]

        if len(existing_tables) == 3:
            logger.info(f"✓ Database schema already exists ({len(existing_tables)} tables found)")
            cursor.close()
            conn.close()
            return True

        logger.info(f"⚠ Database schema incomplete ({len(existing_tables)}/3 tables found)")
        logger.info("Creating database schema...")

        # Read and execute schema.sql
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')

        if not os.path.exists(schema_path):
            logger.error("❌ schema.sql file not found!")
            logger.error("Make sure schema.sql is in the same directory as this script")
            sys.exit(1)

        with open(schema_path, 'r') as f:
            schema_sql = f.read()

        cursor.execute(schema_sql)
        conn.commit()

        # Verify tables were created
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)

        tables = [row[0] for row in cursor.fetchall()]
        logger.info(f"✅ Database schema created successfully ({len(tables)} tables)")

        for table in tables:
            logger.info(f"   - {table}")

        cursor.close()
        conn.close()

        logger.info("")
        return True

    except psycopg2.Error as e:
        logger.error(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        sys.exit(1)


# ============================================================================
# STEP 2: VALIDATE RAILWAY CREDENTIALS
# ============================================================================

def validate_railway_credentials(api_token: str, customer_id: str, workspace_id: str) -> bool:
    """Validate Railway API credentials"""
    logger.info("=" * 70)
    logger.info("STEP 2: Validating Railway API Credentials")
    logger.info("=" * 70)

    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }

    # Test 1: Validate Customer ID
    logger.info(f"Testing Customer ID: {customer_id}...")
    try:
        response = requests.post(
            "https://backboard.railway.com/graphql/internal",
            json={
                "query": """
                    query withdrawalData($customerId: String!) {
                      earningDetails(customerId: $customerId) {
                        lifetimeEarnings
                        templateEarningsLifetime
                      }
                    }
                """,
                "variables": {"customerId": customer_id},
                "operationName": "withdrawalData"
            },
            headers=headers,
            timeout=10
        )

        data = response.json()
        if "errors" in data:
            logger.error(f"❌ Customer ID error: {data['errors'][0].get('message', 'Invalid ID')}")
            sys.exit(1)

        if "data" in data and "earningDetails" in data["data"]:
            earnings = data["data"]["earningDetails"]
            lifetime = earnings.get("lifetimeEarnings", 0)
            logger.info(f"✓ Customer ID valid - Lifetime earnings: ${lifetime / 100:.2f}")

    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Network error: {e}")
        sys.exit(1)

    # Test 3: Validate Workspace ID
    logger.info(f"Testing Workspace ID: {workspace_id}...")
    try:
        response = requests.post(
            "https://backboard.railway.com/graphql/internal",
            json={
                "query": """
                    query workspaceTemplates($workspaceId: String!) {
                      workspaceTemplates(workspaceId: $workspaceId) {
                        edges {
                          node {
                            id
                            name
                          }
                        }
                      }
                    }
                """,
                "variables": {"workspaceId": workspace_id},
                "operationName": "workspaceTemplates"
            },
            headers=headers,
            timeout=10
        )

        data = response.json()
        if "errors" in data:
            logger.error(f"❌ Workspace ID error: {data['errors'][0].get('message', 'Invalid ID')}")
            sys.exit(1)

        if "data" in data and "workspaceTemplates" in data["data"]:
            edges = data["data"]["workspaceTemplates"].get("edges", [])
            logger.info(f"✓ Workspace ID valid - Found {len(edges)} templates")

    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Network error: {e}")
        sys.exit(1)

    logger.info("✅ All Railway credentials validated\n")
    return True


# ============================================================================
# STEP 3: FETCH METRICS FROM RAILWAY
# ============================================================================

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


def fetch_railway_metrics(api_token: str, customer_id: str, workspace_id: str) -> tuple:
    """Fetch all metrics from Railway API"""
    logger.info("=" * 70)
    logger.info("STEP 3: Fetching Metrics from Railway API")
    logger.info("=" * 70)

    client = RailwayAPIClient(api_token)

    # Fetch earnings data
    logger.info("Fetching earnings data...")
    earnings_data = client.get_earnings_data(customer_id)

    if not earnings_data:
        logger.error("❌ Failed to fetch earnings data")
        sys.exit(1)

    logger.info(f"✓ Earnings data fetched - Template earnings: ${earnings_data.get('templateEarningsLifetime', 0) / 100:.2f} lifetime")

    # Fetch template data
    logger.info("Fetching template data...")
    templates = client.get_workspace_templates(workspace_id)

    if not templates:
        logger.error("❌ Failed to fetch template data")
        sys.exit(1)

    logger.info(f"✓ Template data fetched - {len(templates)} templates found")

    # Show summary
    total_revenue = sum(t.get('totalPayout', 0) for t in templates)
    total_active = sum(t.get('activeProjects', 0) for t in templates)

    logger.info(f"\n📊 Summary:")
    logger.info(f"   Total templates: {len(templates)}")
    logger.info(f"   Total revenue: ${total_revenue / 100:.2f}")
    logger.info(f"   Total active projects: {total_active}")

    logger.info("✅ All metrics fetched successfully\n")

    return earnings_data, templates


# ============================================================================
# STEP 4: PERSIST DATA TO POSTGRESQL
# ============================================================================

class MetricsDatabase:
    """Database handler for storing metrics"""

    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.conn = None

    def connect(self):
        """Establish database connection"""
        self.conn = psycopg2.connect(self.connection_string)

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()

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
                return True

        except Exception as e:
            logger.error(f"Failed to insert earnings snapshot: {e}")
            self.conn.rollback()
            return False

    def insert_template_snapshots(self, templates: List[Dict], collected_at: datetime) -> bool:
        """Insert template snapshots into database"""
        try:
            with self.conn.cursor() as cursor:
                template_data = []

                for template in templates:
                    projects = template.get("projects", 0)
                    active_projects = template.get("activeProjects", 0)
                    recent_projects = template.get("recentProjects", 0)
                    total_payout = template.get("totalPayout", 0)

                    # Calculate derived metrics
                    retention_rate = (active_projects / projects * 100) if projects > 0 else 0
                    revenue_per_active = (total_payout // active_projects) if active_projects > 0 else 0
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
                return True

        except Exception as e:
            logger.error(f"Failed to insert template snapshots: {e}")
            self.conn.rollback()
            return False

    def calculate_derived_metrics(self, collected_at: datetime) -> bool:
        """Calculate and store derived metrics"""
        try:
            with self.conn.cursor() as cursor:
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
                return True

        except Exception as e:
            logger.error(f"Failed to calculate derived metrics: {e}")
            self.conn.rollback()
            return False


def persist_metrics(database_url: str, earnings_data: Dict, templates: List[Dict], collected_at: datetime):
    """Persist all metrics to PostgreSQL"""
    logger.info("=" * 70)
    logger.info("STEP 4: Persisting Data to PostgreSQL")
    logger.info("=" * 70)

    db = MetricsDatabase(database_url)

    try:
        db.connect()
        logger.info("✓ Database connection established")

        # Insert earnings snapshot
        logger.info("Storing earnings snapshot...")
        if not db.insert_earnings_snapshot(earnings_data, collected_at):
            logger.error("❌ Failed to store earnings snapshot")
            sys.exit(1)
        logger.info(f"✓ Earnings snapshot stored")

        # Insert template snapshots
        logger.info(f"Storing {len(templates)} template snapshots...")
        if not db.insert_template_snapshots(templates, collected_at):
            logger.error("❌ Failed to store template snapshots")
            sys.exit(1)
        logger.info(f"✓ Template snapshots stored ({len(templates)} templates)")

        # Calculate derived metrics
        logger.info("Calculating derived metrics...")
        if not db.calculate_derived_metrics(collected_at):
            logger.warning("⚠ Failed to calculate derived metrics (expected on first run)")
        else:
            logger.info("✓ Derived metrics calculated")

        logger.info("✅ All data persisted successfully\n")

    except Exception as e:
        logger.error(f"❌ Database error: {e}")
        sys.exit(1)
    finally:
        db.close()


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main execution function - runs all steps in order"""
    start_time = datetime.now(timezone.utc)

    logger.info("=" * 70)
    logger.info("RAILWAY TEMPLATE METRICS COLLECTOR")
    logger.info("=" * 70)
    logger.info(f"Started at: {start_time.isoformat()}")
    logger.info("")

    try:
        # Step 0: Validate environment variables
        config = validate_environment()

        # Step 1: Ensure database schema exists
        ensure_database_schema(config["DATABASE_URL"])

        # Step 2: Validate Railway credentials
        validate_railway_credentials(
            config["RAILWAY_API_TOKEN"],
            config["RAILWAY_CUSTOMER_ID"],
            config["RAILWAY_WORKSPACE_ID"]
        )

        # Step 3: Fetch metrics from Railway
        earnings_data, templates = fetch_railway_metrics(
            config["RAILWAY_API_TOKEN"],
            config["RAILWAY_CUSTOMER_ID"],
            config["RAILWAY_WORKSPACE_ID"]
        )

        # Step 4: Persist data to PostgreSQL
        persist_metrics(
            config["DATABASE_URL"],
            earnings_data,
            templates,
            start_time
        )

        # Success summary
        end_time = datetime.now(timezone.utc)
        duration = (end_time - start_time).total_seconds()

        logger.info("=" * 70)
        logger.info("✅ METRICS COLLECTION COMPLETED SUCCESSFULLY")
        logger.info("=" * 70)
        logger.info(f"Collection timestamp: {start_time.isoformat()}")
        logger.info(f"Execution time: {duration:.2f} seconds")
        logger.info(f"Templates processed: {len(templates)}")
        logger.info(f"Template revenue: ${sum(t.get('totalPayout', 0) for t in templates) / 100:.2f}")
        logger.info("=" * 70)

    except KeyboardInterrupt:
        logger.warning("\n⚠ Interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
