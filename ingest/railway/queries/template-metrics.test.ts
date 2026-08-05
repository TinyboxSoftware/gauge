/**
 * Tests for the templateMetrics query builder
 *
 * The builder exists because templateMetrics takes one id at a time. The rules
 * it has to keep are that aliases match between query and variables, and that a
 * batch stays under Railway's query breadth cap.
 */

import { describe, test, expect } from 'bun:test';
import {
  buildTemplateMetricsQuery,
  buildTemplateMetricsVariables,
  metricsAlias,
  TEMPLATE_METRICS_BATCH_SIZE,
} from './template-metrics';

// Each template contributes its own node plus the fields selected on it.
const NODES_PER_TEMPLATE = 10;
const BREADTH_LIMIT = 500;

describe('buildTemplateMetricsQuery', () => {
  test('declares one variable and one alias per template', () => {
    const query = buildTemplateMetricsQuery(['a', 'b', 'c']);

    expect(query).toContain('$t0: String!');
    expect(query).toContain('$t2: String!');
    expect(query).toContain('t0: templateMetrics(id: $t0)');
    expect(query).toContain('t2: templateMetrics(id: $t2)');
    expect(query.match(/templateMetrics\(id:/g)).toHaveLength(3);
  });

  test('selects the fields the snapshot table stores', () => {
    const query = buildTemplateMetricsQuery(['a']);

    for (const field of [
      'templateHealth',
      'supportHealth',
      'totalDeployments',
      'deploymentsLast90Days',
      'activeDeployments',
      'totalEarnings',
      'earningsLast30Days',
      'earningsLast90Days',
      'eligibleForSupportBonus',
    ]) {
      expect(query).toContain(field);
    }
  });

  test('variables use the aliases the query declares', () => {
    const ids = ['first', 'second'];
    const variables = buildTemplateMetricsVariables(ids);

    expect(variables).toEqual({ t0: 'first', t1: 'second' });
    for (const [index, id] of ids.entries()) {
      expect(variables[metricsAlias(index)]).toBe(id);
    }
  });

  test('a full batch stays under the breadth cap', () => {
    const ids = Array.from({ length: TEMPLATE_METRICS_BATCH_SIZE }, (_, i) => `id-${i}`);
    const query = buildTemplateMetricsQuery(ids);

    expect(TEMPLATE_METRICS_BATCH_SIZE * NODES_PER_TEMPLATE).toBeLessThan(BREADTH_LIMIT);
    expect(query.match(/templateMetrics\(id:/g)).toHaveLength(TEMPLATE_METRICS_BATCH_SIZE);
  });

  test('empty input produces no variables', () => {
    expect(buildTemplateMetricsVariables([])).toEqual({});
  });
});
