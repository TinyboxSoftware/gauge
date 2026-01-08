#!/usr/bin/env python3
"""
Credential Test Script

This script tests your Railway API credentials before deployment.
Run this to verify your API token, Customer ID, and Workspace ID are correct.
"""

import os
import sys
import requests
from typing import Optional

def test_api_token(token: str) -> bool:
    """Test if the API token is valid"""
    print("🔑 Testing Railway API token...")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Simple query to test authentication
    query = """
    query {
      me {
        id
        name
        email
      }
    }
    """

    try:
        response = requests.post(
            "https://backboard.railway.com/graphql/internal",
            json={"query": query},
            headers=headers,
            timeout=10
        )

        if response.status_code == 401:
            print("❌ API token is invalid or expired")
            return False

        data = response.json()

        if "errors" in data:
            print(f"❌ API error: {data['errors'][0].get('message', 'Unknown error')}")
            return False

        if "data" in data and "me" in data["data"]:
            user = data["data"]["me"]
            print(f"✅ API token valid! Authenticated as: {user.get('name', 'Unknown')} ({user.get('email', 'N/A')})")
            return True

    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return False

    return False


def test_customer_id(token: str, customer_id: str) -> bool:
    """Test if the customer ID is valid"""
    print(f"\n👤 Testing Customer ID: {customer_id}")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    query = """
    query withdrawalData($customerId: String!) {
      earningDetails(customerId: $customerId) {
        lifetimeEarnings
        templateEarningsLifetime
      }
    }
    """

    try:
        response = requests.post(
            "https://backboard.railway.com/graphql/internal",
            json={
                "query": query,
                "variables": {"customerId": customer_id},
                "operationName": "withdrawalData"
            },
            headers=headers,
            timeout=10
        )

        data = response.json()

        if "errors" in data:
            print(f"❌ Customer ID error: {data['errors'][0].get('message', 'Unknown error')}")
            return False

        if "data" in data and "earningDetails" in data["data"]:
            earnings = data["data"]["earningDetails"]
            lifetime = earnings.get("lifetimeEarnings", 0)
            template = earnings.get("templateEarningsLifetime", 0)

            print(f"✅ Customer ID valid!")
            print(f"   Lifetime earnings: ${lifetime / 100:.2f}")
            print(f"   Template earnings: ${template / 100:.2f}")
            return True

    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return False

    return False


def test_workspace_id(token: str, workspace_id: str) -> bool:
    """Test if the workspace ID is valid"""
    print(f"\n🏢 Testing Workspace ID: {workspace_id}")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    query = """
    query workspaceTemplates($workspaceId: String!) {
      workspaceTemplates(workspaceId: $workspaceId) {
        edges {
          node {
            id
            name
            activeProjects
            totalPayout
          }
        }
      }
    }
    """

    try:
        response = requests.post(
            "https://backboard.railway.com/graphql/internal",
            json={
                "query": query,
                "variables": {"workspaceId": workspace_id},
                "operationName": "workspaceTemplates"
            },
            headers=headers,
            timeout=10
        )

        data = response.json()

        if "errors" in data:
            print(f"❌ Workspace ID error: {data['errors'][0].get('message', 'Unknown error')}")
            return False

        if "data" in data and "workspaceTemplates" in data["data"]:
            edges = data["data"]["workspaceTemplates"].get("edges", [])
            template_count = len(edges)

            print(f"✅ Workspace ID valid!")
            print(f"   Found {template_count} templates")

            if template_count > 0:
                print(f"\n   Top templates:")
                for i, edge in enumerate(edges[:5]):
                    node = edge["node"]
                    print(f"   {i+1}. {node.get('name', 'Unknown')} - "
                          f"${node.get('totalPayout', 0) / 100:.2f} revenue, "
                          f"{node.get('activeProjects', 0)} active projects")

            return True

    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return False

    return False


def main():
    """Main test function"""
    print("=" * 60)
    print("Railway Template Metrics - Credential Test")
    print("=" * 60)
    print()

    # Load environment variables
    api_token = os.getenv("RAILWAY_API_TOKEN")
    customer_id = os.getenv("RAILWAY_CUSTOMER_ID")
    workspace_id = os.getenv("RAILWAY_WORKSPACE_ID")

    # Check if variables are set
    missing = []
    if not api_token:
        missing.append("RAILWAY_API_TOKEN")
    if not customer_id:
        missing.append("RAILWAY_CUSTOMER_ID")
    if not workspace_id:
        missing.append("RAILWAY_WORKSPACE_ID")

    if missing:
        print("❌ Missing environment variables:")
        for var in missing:
            print(f"   - {var}")
        print()
        print("💡 Set these variables and try again:")
        print("   export RAILWAY_API_TOKEN='your-token'")
        print("   export RAILWAY_CUSTOMER_ID='your-uuid'")
        print("   export RAILWAY_WORKSPACE_ID='your-uuid'")
        print()
        print("Or create a .env file (see .env.example)")
        sys.exit(1)

    # Run tests
    results = {
        "api_token": test_api_token(api_token),
        "customer_id": test_customer_id(api_token, customer_id),
        "workspace_id": test_workspace_id(api_token, workspace_id)
    }

    # Summary
    print()
    print("=" * 60)
    print("Test Summary")
    print("=" * 60)

    all_passed = all(results.values())

    if all_passed:
        print("✅ All tests passed! Your credentials are valid.")
        print()
        print("🚀 Next steps:")
        print("   1. Deploy PostgreSQL: railway add --database postgresql")
        print("   2. Initialize database: railway run python setup_database.py")
        print("   3. Test collection: railway run python collect_metrics.py")
        print("   4. Deploy service: railway up")
    else:
        print("❌ Some tests failed. Please check the errors above.")
        print()
        print("Common issues:")
        print("   - API token expired: Generate a new one at https://railway.app/account/tokens")
        print("   - Wrong Customer/Workspace ID: Check the Railway dashboard URL")
        print("   - Network issues: Verify your internet connection")

        sys.exit(1)


if __name__ == "__main__":
    main()
