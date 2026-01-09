#!/usr/bin/env python3
"""
YTD Goal Management Script

This script helps you set and manage your annual revenue goals for YTD tracking.
"""

import os
import sys
import argparse
import psycopg2
from datetime import datetime

def get_database_url():
    """Get database URL from environment"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ Error: DATABASE_URL environment variable not set")
        print("Set it in your .env file or Railway dashboard")
        sys.exit(1)
    return database_url

def set_goal(year: int, amount: float, notes: str = None):
    """Set or update a yearly goal"""
    database_url = get_database_url()

    # Convert dollars to cents
    amount_cents = int(amount * 100)

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        # Use the upsert function from schema
        cursor.execute(
            "SELECT upsert_yearly_goal(%s, %s, %s)",
            (year, amount_cents, notes)
        )

        conn.commit()

        print(f"✅ Goal set successfully!")
        print(f"   Year: {year}")
        print(f"   Goal: ${amount:,.2f}")
        if notes:
            print(f"   Notes: {notes}")

        cursor.close()
        conn.close()

    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)

def view_goals():
    """View all yearly goals"""
    database_url = get_database_url()

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT year, goal_amount, notes, updated_at
            FROM yearly_goals
            ORDER BY year DESC
        """)

        goals = cursor.fetchall()

        if not goals:
            print("No goals set yet. Use --set to create one.")
            return

        print("\n📊 Your Annual Revenue Goals:\n")
        print("=" * 70)

        for year, amount_cents, notes, updated_at in goals:
            amount = amount_cents / 100.0
            print(f"Year {year}: ${amount:,.2f}")
            if notes:
                print(f"  Notes: {notes}")
            print(f"  Last updated: {updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
            print()

        cursor.close()
        conn.close()

    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)

def view_current_progress():
    """View current YTD progress"""
    database_url = get_database_url()

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM ytd_progress")
        row = cursor.fetchone()

        if not row:
            print("❌ No data available yet. Run collect_metrics.py first.")
            return

        # Unpack the view columns
        (year, ytd_earnings_dollars, ytd_earnings, goal_amount, goal_dollars,
         progress_percentage, remaining_to_goal, remaining_to_goal_dollars,
         days_elapsed, days_remaining, year_completion_percentage,
         avg_daily_earnings, avg_daily_earnings_dollars,
         projected_year_end, projected_year_end_dollars,
         required_daily_avg, required_daily_avg_dollars,
         pace_status, last_updated, goal_notes) = row

        print(f"\n📈 YTD Progress for {year}\n")
        print("=" * 70)
        print(f"YTD Earnings:           ${ytd_earnings_dollars:,.2f}")
        print(f"Annual Goal:            ${goal_dollars:,.2f}")
        print(f"Progress:               {progress_percentage:.1f}%")
        print()
        print(f"Remaining to Goal:      ${remaining_to_goal_dollars:,.2f}")
        print(f"Days Elapsed:           {days_elapsed}")
        print(f"Days Remaining:         {days_remaining}")
        print(f"Year Completion:        {year_completion_percentage:.1f}%")
        print()
        print(f"Avg Daily Earnings:     ${avg_daily_earnings_dollars:.2f}/day")
        print(f"Projected Year-End:     ${projected_year_end_dollars:,.2f}")
        print(f"Required Daily Avg:     ${required_daily_avg_dollars:.2f}/day")
        print()

        # Color-coded status
        if pace_status == "On Track":
            status_symbol = "✓"
        elif pace_status == "Behind":
            status_symbol = "⚠"
        else:
            status_symbol = "ℹ"

        print(f"Pace Status:            {status_symbol} {pace_status}")
        print(f"Last Updated:           {last_updated.strftime('%Y-%m-%d %H:%M:%S')}")

        if goal_notes:
            print(f"\nGoal Notes: {goal_notes}")

        print("=" * 70)

        cursor.close()
        conn.close()

    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(
        description="Manage annual revenue goals for YTD tracking",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Set goal for current year
  python set_goal.py --set 50000

  # Set goal for specific year with notes
  python set_goal.py --set 75000 --year 2026 --notes "Stretch goal for Q2 product launch"

  # View all goals
  python set_goal.py --view

  # View current YTD progress
  python set_goal.py --progress
        """
    )

    parser.add_argument("--set", type=float, metavar="AMOUNT",
                       help="Set goal amount in dollars (e.g., 50000)")
    parser.add_argument("--year", type=int, default=datetime.now().year,
                       help="Year for the goal (default: current year)")
    parser.add_argument("--notes", type=str,
                       help="Optional notes about the goal")
    parser.add_argument("--view", action="store_true",
                       help="View all yearly goals")
    parser.add_argument("--progress", action="store_true",
                       help="View current YTD progress")

    args = parser.parse_args()

    # Show help if no arguments provided
    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(0)

    if args.set:
        set_goal(args.year, args.set, args.notes)
    elif args.view:
        view_goals()
    elif args.progress:
        view_current_progress()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
