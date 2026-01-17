# Template Drilldown Dashboard

## Overview

The Template Drilldown dashboard lets you deep-dive into the performance history of a specific template.

It provides detailed time-series data for revenue, projects, and retention to help understand the lifecycle and performance of each of your templates.

## Variables

### Template

- **Purpose**: Select the specific template to analyze.
- **Query**: Populated by a list of all template names and IDs from the database, ordered by total revenue.

### Category

- **Purpose**: Filters the portfolio comparison views to only show templates within specific railway template categories.

## Visualizations

### Template Revenue Trend

- **Purpose**: Tracks the lifetime revenue growth of the selected template over the last 90 days.
- **Calculation**: Time-series plot of `total_payout` for the selected `$template`.

### Active Projects Trend

- **Purpose**: Compares the number of currently active projects against the total number of projects ever created for the template.
- **Calculation**: Plots `active_projects` and `projects` columns over time.

### Retention Rate Over Time

- **Purpose**: Monitors the percentage of projects that remain active, serving as a proxy for template quality and user satisfaction.
- **Calculation**: Time-series plot of `retention_rate` (`active_projects / projects * 100`).

### Revenue Growth Rates

- **Purpose**: High-level growth figures for 24-hour, 7-day, and 30-day windows.
- **Calculation**: Fetches the most recent derived metrics for the selected template.

### Growth Momentum Score

- **Purpose**: Measures "explosive growth" by comparing recent project creation to the total active project base.
- **Calculation**: `recent_projects / active_projects * 100`. Scores above 20% are considered high momentum (Green).

### Scatter Plot: Revenue vs Growth

- **Purpose**: Visualizes where the selected template sits compared to the rest of the portfolio in terms of total revenue vs. 30-day growth.
- **Calculation**: Plots all templates with `active_projects > 0` on an XY chart.

### Template Performance Matrix

- **Purpose**: A comprehensive table allowing for direct comparison of all active templates across metrics like Profitability Score, Retention, and 7-day Revenue.
- **Calculation**: Joins latest metrics with derived metrics, filtered by the selected category.
