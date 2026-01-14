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
  code: z.string(),
  createdAt: z.string(),
  name: z.string(),
  description: z.string(),
  image: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  languages: z.array(z.string()),
  status: z.string(),
  isApproved: z.boolean(),
  isVerified: z.boolean(),
  health: z.string(),
  projects: z.number(),
  activeProjects: z.number(),
  recentProjects: z.number(),
  totalPayout: z.number(),
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

// Infer TypeScript types from schemas
export type EarningDetails = z.infer<typeof EarningDetailsSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type GraphQLError = z.infer<typeof GraphQLErrorSchema>;
export type EarningsResponse = z.infer<typeof EarningsResponseSchema>;
export type TemplatesResponse = z.infer<typeof TemplatesResponseSchema>;
