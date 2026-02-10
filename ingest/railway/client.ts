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
  WorkspaceResponseSchema,
  type EarningDetails,
  type Template,
} from './types';
import { EARNINGS_QUERY, EARNINGS_OPERATION } from './queries/earnings';
import { TEMPLATES_QUERY, TEMPLATES_OPERATION } from './queries/templates';
import { WORKSPACE_QUERY, WORKSPACE_OPERATION } from './queries/workspace';

export interface RailwayClientConfig {
  apiToken: string;
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
  private readonly workspaceId: string;
  private readonly logger?: Logger;
  private customerId: string | null = null;

  constructor(config: RailwayClientConfig) {
    this.apiToken = config.apiToken;
    this.workspaceId = config.workspaceId;
    this.logger = config.logger;
  }

  /**
   * Fetch customer ID from the workspace
   * This is called automatically on first use if not already fetched
   */
  private async fetchCustomerId(): Promise<string> {
    if (this.customerId) {
      return this.customerId;
    }

    this.logger?.info({ workspaceId: this.workspaceId }, 'Fetching customer ID from workspace');

    const response = await this.executeQuery(
      WORKSPACE_QUERY,
      { workspaceId: this.workspaceId },
      WORKSPACE_OPERATION,
      (data) => WorkspaceResponseSchema.parse(data),
    );

    const customerId = response.workspace.customer.id;
    this.customerId = customerId;
    this.logger?.info({ customerId }, 'Customer ID fetched from workspace');

    return customerId;
  }

  /**
   * Execute a GraphQL query against Railway's API with retries
   */
  private async executeQuery<T>(
    query: string,
    variables: Record<string, unknown>,
    operationName: string,
    validator: (data: unknown) => T,
    maxRetries = 3,
  ): Promise<T> {
    const payload = {
      query,
      variables,
      operationName,
    };

    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger?.debug(
          { operationName, variables, attempt }, 
          'Executing Railway GraphQL query'
        );

        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          // Don't retry on 401/403/404
          if ([401, 403, 404].includes(response.status)) {
            throw new RailwayAPIError(
              `HTTP ${response.status}: ${response.statusText}`,
            );
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (error instanceof RailwayAPIError) {
          throw error; // Don't retry validated GraphQL or Auth errors
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger?.warn(
            { error: lastError.message, attempt, nextRetryIn: `${delay}ms` },
            'Railway API request failed, retrying...'
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.logger?.error({ error: lastError?.message, operationName }, 'Railway API request failed after all attempts');
    throw lastError;
  }

  /**
   * Fetch earnings data for the configured customer
   *
   * Returns lifetime earnings, withdrawals, and 30-day earnings broken down by source
   * (templates, referrals, bounties, threads)
   */
  async getEarnings(): Promise<EarningDetails> {
    const customerId = await this.fetchCustomerId();
    this.logger?.info({ customerId }, 'Fetching earnings data from Railway');

    const response = await this.executeQuery(
      EARNINGS_QUERY,
      { customerId },
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