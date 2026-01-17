/**
 * Zod schemas and TypeScript types for database rows
 * Provides type safety for database operations
 */

import { z } from 'zod';

/**
 * Schema for earnings_snapshots table rows
 */
export const EarningsSnapshotSchema = z.object({
  id: z.number(),
  collected_at: z.date(),
  lifetime_earnings: z.number(),
  lifetime_cash_withdrawals: z.number(),
  lifetime_credit_withdrawals: z.number(),
  available_balance: z.number(),
  template_earnings_lifetime: z.number(),
  template_earnings_30d: z.number(),
  referral_earnings_lifetime: z.number(),
  referral_earnings_30d: z.number(),
  bounty_earnings_lifetime: z.number(),
  bounty_earnings_30d: z.number(),
  thread_earnings_lifetime: z.number(),
  thread_earnings_30d: z.number(),
  created_at: z.date(),
});

/**
 * Schema for template_snapshots table rows
 * Includes calculated metrics (retention_rate, revenue_per_active, growth_momentum)
 */
export const TemplateSnapshotSchema = z.object({
  id: z.number(),
  collected_at: z.date(),
  template_id: z.string(),
  template_code: z.string().nullable(),
  template_name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  tags: z.string(), // JSONB stored as string
  languages: z.string(), // JSONB stored as string
  image: z.string().nullable(),
  status: z.string().nullable(),
  is_approved: z.boolean().nullable(),
  is_verified: z.boolean().nullable(),
  health: z.number().nullable(),
  projects: z.number(),
  active_projects: z.number(),
  recent_projects: z.number(),
  total_payout: z.number(),
  retention_rate: z.number().nullable(),
  revenue_per_active: z.number().nullable(),
  growth_momentum: z.number().nullable(),
  created_at: z.date(),
});

/**
 * Schema for template_metrics_derived table rows
 */
export const TemplateMetricsDerivedSchema = z.object({
  id: z.number(),
  calculated_at: z.date(),
  template_id: z.string(),
  template_name: z.string(),
  revenue_growth_24h: z.number().nullable(),
  revenue_growth_7d: z.number().nullable(),
  revenue_growth_30d: z.number().nullable(),
  active_projects_change_24h: z.number().nullable(),
  active_projects_change_7d: z.number().nullable(),
  active_projects_change_30d: z.number().nullable(),
  avg_daily_revenue_7d: z.number().nullable(),
  avg_daily_revenue_30d: z.number().nullable(),
  profitability_score: z.number().nullable(),
  created_at: z.date(),
});

// Export inferred TypeScript types
export type EarningsSnapshot = z.infer<typeof EarningsSnapshotSchema>;
export type TemplateSnapshot = z.infer<typeof TemplateSnapshotSchema>;
export type TemplateMetricsDerived = z.infer<typeof TemplateMetricsDerivedSchema>;
