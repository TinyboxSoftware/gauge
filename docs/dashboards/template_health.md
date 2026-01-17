# Template Health & Alerts Dashboard

## Overview

The Template Health & Alerts dashboard focuses on identifying issues and declining trends across your template portfolio.

It highlights templates with low health scores, negative growth, or stagnant project creation to facilitate proactive maintenance and optimization. Identify templates that are in decline and clean them up!

## Visualizations

### Critical Health Alerts

- **Purpose**: Lists all templates that are currently reporting a health score below 70.
- **Calculation**: Queries `latest_template_metrics` where `health < 70`. Categorizes severity as 'CRITICAL' (<60) or 'WARNING' (<70).

### Declining Template Health

- **Purpose**: Identifies templates that have lost active projects or seen a revenue drop over the last 7 days.
- **Calculation**: Joins `latest_template_metrics` with `template_metrics_derived` to find records where `active_projects_change_7d` or `revenue_growth_7d` is negative.

### Zero Recent Projects (Stinkers)

- **Purpose**: Highlights "stagnant" templates that have active projects but have not had a single new project created in the most recent tracking period.
- **Calculation**: Filters for templates where `recent_projects = 0` but `active_projects > 0`.
