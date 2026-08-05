/**
 * Zod schemas for Railway GraphQL API responses
 * Provides runtime validation and type inference
 */

import { z } from 'zod';

// Earnings details schema
export const EarningDetailsSchema = z.object({
  lifetimeEarnings: z.number(),
  referralEarningsLifetime: z.number(),
  referralEarnings30d: z.number(),
  templateEarningsLifetime: z.number(),
  templateEarnings30d: z.number(),
  bountyEarningsLifetime: z.number(),
  bountyEarnings30d: z.number(),
  threadEarningsLifetime: z.number(),
  threadEarnings30d: z.number(),
  availableBalance: z.number(),
  lifetimeCashWithdrawals: z.number(),
  lifetimeCreditWithdrawals: z.number(),
});

// Template schema
export const TemplateSchema = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  createdAt: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional().transform(v => v ?? []),
  languages: z.array(z.string()).nullable().optional().transform(v => v ?? []),
  status: z.string().nullable().optional(),
  isApproved: z.boolean().nullable().optional(),
  isVerified: z.boolean().nullable().optional(),
  health: z.union([z.string(), z.number()]).nullable().optional(),
  projects: z.number().nullable().optional().transform(v => v ?? 0),
  activeProjects: z.number().nullable().optional().transform(v => v ?? 0),
  recentProjects: z.number().nullable().optional().transform(v => v ?? 0),
  totalPayout: z.number().nullable().optional().transform(v => v ?? 0),
});

// Per-template deployment metrics schema (creator-private counters)
export const TemplateMetricsSchema = z.object({
  templateHealth: z.number(),
  supportHealth: z.number(),
  totalDeployments: z.number(),
  deploymentsLast90Days: z.number(),
  activeDeployments: z.number(),
  // Earnings here are dollars, unlike the cents used by earningDetails
  totalEarnings: z.number(),
  earningsLast30Days: z.number(),
  earningsLast90Days: z.number(),
  eligibleForSupportBonus: z.boolean(),
});

// GraphQL error schema
export const GraphQLErrorSchema = z.object({
  message: z.string(),
  locations: z.array(z.object({
    line: z.number(),
    column: z.number(),
  })).optional(),
  path: z.array(z.string()).optional(),
});

// Generic GraphQL response wrapper
export const createGraphQLResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema.optional(),
    errors: z.array(GraphQLErrorSchema).optional(),
  });

// Earnings response schema
export const EarningsResponseSchema = z.object({
  earningDetails: EarningDetailsSchema,
});

// Templates response schema
export const TemplatesResponseSchema = z.object({
  workspaceTemplates: z.object({
    edges: z.array(z.object({
      node: TemplateSchema,
    })),
  }),
});

// Template metrics response schema
// One entry per alias in the generated query; a template the API declines to
// report on comes back as null rather than as an error.
export const TemplateMetricsResponseSchema = z.record(
  z.string(),
  TemplateMetricsSchema.nullable(),
);

// Workspace response schema (for fetching customer ID)
export const WorkspaceResponseSchema = z.object({
  workspace: z.object({
    customer: z.object({
      id: z.string(),
    }),
  }),
});

// Infer TypeScript types from schemas
export type EarningDetails = z.infer<typeof EarningDetailsSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type TemplateMetrics = z.infer<typeof TemplateMetricsSchema>;
export type TemplateMetricsResponse = z.infer<typeof TemplateMetricsResponseSchema>;
export type GraphQLError = z.infer<typeof GraphQLErrorSchema>;
export type EarningsResponse = z.infer<typeof EarningsResponseSchema>;
export type TemplatesResponse = z.infer<typeof TemplatesResponseSchema>;
export type WorkspaceResponse = z.infer<typeof WorkspaceResponseSchema>;
