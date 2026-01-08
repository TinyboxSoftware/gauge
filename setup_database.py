#!/usr/bin/env python3
"""
Database Setup Script

This script initializes the PostgreSQL database with the required schema.
Run this once before starting the metrics collection.
"""

import os
import sys
import psycopg2

def setup_database():
    """Initialize database with schema"""
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("❌ ERROR: DATABASE_URL environment variable not set")
        print("Please set DATABASE_URL to your PostgreSQL connection string")
        sys.exit(1)

    print("🔧 Setting up Railway Template Metrics database...")

    try:
        # Read schema file
        with open('schema.sql', 'r') as f:
            schema_sql = f.read()

        # Connect to database
        print("📡 Connecting to database...")
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        # Execute schema
        print("📝 Creating tables, views, and functions...")
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

        tables = cursor.fetchall()
        print("\n✅ Database setup complete!")
        print("\n📊 Created tables:")
        for table in tables:
            print(f"  - {table[0]}")

        # Verify views
        cursor.execute("""
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)

        views = cursor.fetchall()
        if views:
            print("\n👁️  Created views:")
            for view in views:
                print(f"  - {view[0]}")

        cursor.close()
        conn.close()

        print("\n🚀 Ready to collect metrics!")
        print("Run: python collect_metrics.py")

    except FileNotFoundError:
        print("❌ ERROR: schema.sql file not found")
        print("Make sure you're running this script from the repository root")
        sys.exit(1)

    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)

    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    setup_database()
