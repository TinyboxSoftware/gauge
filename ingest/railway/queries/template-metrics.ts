/**
 * GraphQL query for per-template deployment metrics.
 *
 * These are the creator-private counters behind the number shown on a template
 * card: how many times the template was deployed and what share of those deploys
 * succeeded. `workspaceTemplates` only exposes the rounded percentage, so the
 * failure count has to come from here.
 *
 * templateMetrics takes one template id, so the query is assembled with an alias
 * per template and the whole workspace arrives in a single round trip.
 */

export const TEMPLATE_METRICS_OPERATION = 'templateMetrics';

/**
 * Templates per request.
 *
 * Railway rejects a query whose breadth exceeds 500, and each template costs its
 * own node plus the nine fields below - ten. Fifty would sit exactly on the
 * limit, so this leaves room for a field to be added later without the query
 * starting to fail in production.
 */
export const TEMPLATE_METRICS_BATCH_SIZE = 40;

const METRIC_FIELDS = `
      templateHealth
      supportHealth
      totalDeployments
      deploymentsLast90Days
      activeDeployments
      totalEarnings
      earningsLast30Days
      earningsLast90Days
      eligibleForSupportBonus`;

/** Alias used for the template at `index`, shared by the query and its parser. */
export const metricsAlias = (index: number): string => `t${index}`;

export function buildTemplateMetricsQuery(templateIds: string[]): string {
  const params = templateIds.map((_, i) => `$${metricsAlias(i)}: String!`).join(', ');
  const selections = templateIds
    .map((_, i) => `    ${metricsAlias(i)}: templateMetrics(id: $${metricsAlias(i)}) {${METRIC_FIELDS}\n    }`)
    .join('\n');

  return `query ${TEMPLATE_METRICS_OPERATION}(${params}) {\n${selections}\n  }`;
}

export function buildTemplateMetricsVariables(
  templateIds: string[],
): Record<string, string> {
  return Object.fromEntries(templateIds.map((id, i) => [metricsAlias(i), id]));
}
