/**
 * Railway GraphQL API Client
 *
 * A clean, class-based HTTP client for interacting with Railway's GraphQL API.
 * Uses Zod for runtime validation and provides clear error messages.
 */

import type { Logger } from 'pino';
import {
  EarningsResponseSchema,
  TemplatesResponseSchema,
  type EarningDetails,
  type Template,
} from './types';
import { EARNINGS_QUERY, EARNINGS_OPERATION } from './queries/earnings';
import { TEMPLATES_QUERY, TEMPLATES_OPERATION } from './queries/templates';

export interface RailwayClientConfig {
  apiToken: string;
  customerId: string;
  workspaceId: string;
  logger?: Logger;
}

export class RailwayAPIError extends Error {
  constructor(
    message: string,
    public readonly graphqlErrors?: Array<{ message: string }>,
  ) {
    super(message);
    this.name = 'RailwayAPIError';
  }
}

export class RailwayClient {
  private readonly endpoint = 'https://backboard.railway.com/graphql/internal';
  private readonly apiToken: string;
  private readonly customerId: string;
  private readonly workspaceId: string;
  private readonly logger?: Logger;

  constructor(config: RailwayClientConfig) {
    this.apiToken = config.apiToken;
    this.customerId = config.customerId;
    this.workspaceId = config.workspaceId;
    this.logger = config.logger;
  }

  /**
   * Execute a GraphQL query against Railway's API
   */
  private async executeQuery<T>(
    query: string,
    variables: Record<string, unknown>,
    operationName: string,
    validator: (data: unknown) => T,
  ): Promise<T> {
    const payload = {
      query,
      variables,
      operationName,
    };

    this.logger?.debug({ operationName, variables }, 'Executing Railway GraphQL query');

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new RailwayAPIError(
          `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const rawData = await response.json() as {
        data?: unknown;
        errors?: Array<{ message: string }>;
      };

      // Check for GraphQL errors
      if (rawData.errors) {
        const errorMessages = rawData.errors.map((e) => e.message).join(', ');
        throw new RailwayAPIError(
          `GraphQL errors: ${errorMessages}`,
          rawData.errors,
        );
      }

      // Validate the response data
      const validated = validator(rawData.data);

      this.logger?.debug({ operationName }, 'Successfully validated Railway API response');

      return validated;

    } catch (error) {
      if (error instanceof RailwayAPIError) {
        throw error;
      }

      this.logger?.error({ error, operationName }, 'Railway API request failed');

      throw new RailwayAPIError(
        `Failed to execute ${operationName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Fetch earnings data for the configured customer
   *
   * Returns lifetime earnings, withdrawals, and 30-day earnings broken down by source
   * (templates, referrals, bounties, threads)
   */
  async getEarnings(): Promise<EarningDetails> {
    this.logger?.info({ customerId: this.customerId }, 'Fetching earnings data from Railway');

    const response = await this.executeQuery(
      EARNINGS_QUERY,
      { customerId: this.customerId },
      EARNINGS_OPERATION,
      (data) => EarningsResponseSchema.parse(data),
    );

    return response.earningDetails;
  }

  /**
   * Fetch all templates for the configured workspace
   *
   * Returns template metadata, metrics (projects, active projects, revenue),
   * and health/status information
   */
  async getTemplates(): Promise<Template[]> {
    this.logger?.info({ workspaceId: this.workspaceId }, 'Fetching templates from Railway');

    const response = await this.executeQuery(
      TEMPLATES_QUERY,
      { workspaceId: this.workspaceId },
      TEMPLATES_OPERATION,
      (data) => TemplatesResponseSchema.parse(data),
    );

    const templates = response.workspaceTemplates.edges.map(edge => edge.node);

    this.logger?.info({ count: templates.length }, 'Successfully fetched templates');

    return templates;
  }

  /**
   * Validate credentials by making a test API call
   *
   * Useful for testing configuration before running full collection
   */
  async validateCredentials(): Promise<boolean> {
    this.logger?.info('Validating Railway API credentials');

    try {
      // Make a simple earnings call to validate
      await this.getEarnings();
      this.logger?.info('Railway API credentials validated successfully');
      return true;
    } catch (error) {
      this.logger?.error({ error }, 'Railway API credentials validation failed');
      throw error;
    }
  }
}