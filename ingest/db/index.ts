/**
 * Public exports for the database module
 */

export { GaugeDatabase } from './client';
export type { GaugeDatabaseConfig } from './client';
export { DatabaseError, SchemaError, InsertError } from './errors';
export type {
	EarningsSnapshot,
	TemplateSnapshot,
	TemplateMetricsDerived,
} from './types';
