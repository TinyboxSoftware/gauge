/**
 * Database client for storing Railway metrics data
 * Mirrors functionality of legacy Python script (_legacy/collect_metrics.py)
 */

import { SQL } from 'bun';
import type { Logger } from 'pino';
import type { EarningDetails, Template } from '../railway/types';
import { DatabaseError, SchemaError, InsertError } from './errors';
import path from 'path';

export interface GaugeDatabaseConfig {
	connectionString: string;
	logger?: Logger;
}

/**
 * Database client for persisting Railway metrics
 */
export class GaugeDatabase {
	private sql: SQL;
	private connectionString: string;
	private logger?: Logger;

	constructor(config: GaugeDatabaseConfig) {
		this.sql = new SQL(config.connectionString);
		this.connectionString = config.connectionString;
		this.logger = config.logger;
	}

	/**
	 * Check which required tables exist in the database
	 */
	private async checkTablesExist(): Promise<string[]> {
		try {
			const result = await this.sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('earnings_snapshots', 'template_snapshots', 'template_metrics_derived')
        ORDER BY table_name
      `;

			return result.map((row: { table_name: string }) => row.table_name);
		} catch (error) {
			throw new DatabaseError('Failed to check if tables exist', error);
		}
	}

	/**
	 * Ensure database schema exists, create if missing
	 * Matches Python: lines 82-151 in collect_metrics.py
	 */
	async ensureSchema(): Promise<void> {
		this.logger?.info('Ensuring database schema exists');

		try {
			// Check if tables exist
			const existingTables = await this.checkTablesExist();

			if (existingTables.length === 3) {
				this.logger?.info(
					{ tableCount: existingTables.length },
					'Database schema already exists'
				);
				return;
			}

			this.logger?.info(
				{ existingTables: existingTables.length, required: 3 },
				'Database schema incomplete, creating schema'
			);

			// Read and execute schema file using Bun.sql.file()
			// Matches Python: lines 112-124 in collect_metrics.py
			const schemaPath = path.join(__dirname, 'schemas', 'gauge.sql');

			if (!(await Bun.file(schemaPath).exists())) {
				throw new SchemaError(`Schema file not found at ${schemaPath}`);
			}

			await this.sql.file(schemaPath);

			// Verify tables were created
			const tables = await this.checkTablesExist();

			if (tables.length < 3) {
				throw new SchemaError(
					`Failed to create all required tables (created ${tables.length}/3)`
				);
			}

			this.logger?.info(
				{ tableCount: tables.length, tables },
				'Database schema created successfully'
			);
		} catch (error) {
			if (error instanceof SchemaError) {
				throw error;
			}
			throw new SchemaError('Failed to ensure database schema', error);
		}
	}

	/**
	 * Insert earnings snapshot into database
	 * Matches Python: lines 420-466 in collect_metrics.py
	 */
	async insertEarningsSnapshot(
		earnings: EarningDetails,
		collectedAt: Date
	): Promise<void> {
		this.logger?.info('Inserting earnings snapshot');

		try {
			await this.sql`
        INSERT INTO earnings_snapshots (
          collected_at,
          lifetime_earnings,
          lifetime_cash_withdrawals,
          lifetime_credit_withdrawals,
          available_balance,
          template_earnings_lifetime,
          template_earnings_30d,
          referral_earnings_lifetime,
          referral_earnings_30d,
          bounty_earnings_lifetime,
          bounty_earnings_30d,
          thread_earnings_lifetime,
          thread_earnings_30d
        ) VALUES (
          ${collectedAt},
          ${earnings.lifetimeEarnings},
          ${earnings.lifetimeCashWithdrawals},
          ${earnings.lifetimeCreditWithdrawals},
          ${earnings.availableBalance},
          ${earnings.templateEarningsLifetime},
          ${earnings.templateEarnings30d},
          ${earnings.referralEarningsLifetime},
          ${earnings.referralEarnings30d},
          ${earnings.bountyEarningsLifetime},
          ${earnings.bountyEarnings30d},
          ${earnings.threadEarningsLifetime},
          ${earnings.threadEarnings30d}
        )
      `;

			this.logger?.info('Earnings snapshot inserted successfully');
		} catch (error) {
			throw new InsertError('Failed to insert earnings snapshot', error);
		}
	}

	/**
	 * Insert template snapshots with calculated metrics into database
	 * Matches Python: lines 468-541 in collect_metrics.py
	 */
	async insertTemplateSnapshots(
		templates: Template[],
		collectedAt: Date
	): Promise<number> {
		this.logger?.info({ count: templates.length }, 'Inserting template snapshots');

		if (templates.length === 0) {
			this.logger?.warn('No templates to insert');
			return 0;
		}

		try {
			// Transform templates with calculated metrics
			// Matches Python lines 474-506
			const rows = templates.map((t) => {
				// Calculate retention rate: (active_projects / projects * 100) if projects > 0
				const retentionRate = t.projects > 0
					? (t.activeProjects / t.projects) * 100
					: 0;

				// Calculate revenue per active: total_payout / active_projects if active > 0
				const revenuePerActive = t.activeProjects > 0
					? Math.floor(t.totalPayout / t.activeProjects)
					: 0;

				// Calculate growth momentum: (recent_projects / active_projects * 100) if active > 0
				const growthMomentum = t.activeProjects > 0
					? (t.recentProjects / t.activeProjects) * 100
					: 0;

				return {
					collected_at: collectedAt,
					template_id: t.id,
					template_code: t.code,
					template_name: t.name,
					description: t.description,
					category: t.category,
					tags: JSON.stringify(t.tags),
					languages: JSON.stringify(t.languages),
					image: t.image,
					status: t.status,
					is_approved: t.isApproved,
					is_verified: t.isVerified,
					health: parseInt(t.health), // Convert string to integer
					projects: t.projects,
					active_projects: t.activeProjects,
					recent_projects: t.recentProjects,
					total_payout: t.totalPayout,
					retention_rate: Math.round(retentionRate * 100) / 100, // Round to 2 decimals
					revenue_per_active: revenuePerActive,
					growth_momentum: Math.round(growthMomentum * 100) / 100, // Round to 2 decimals
				};
			});

			// Bulk insert with conflict handling
			// Matches Python lines 508-535
			await this.sql`
        INSERT INTO template_snapshots ${this.sql(rows)}
        ON CONFLICT (collected_at, template_id) DO NOTHING
      `;

			this.logger?.info(
				{ count: templates.length },
				'Template snapshots inserted successfully'
			);

			return templates.length;
		} catch (error) {
			throw new InsertError('Failed to insert template snapshots', error);
		}
	}

	/**
	 * Calculate and store derived metrics (growth rates, profitability scores)
	 * Matches Python: lines 543-634 in collect_metrics.py
	 */
	async calculateDerivedMetrics(collectedAt: Date): Promise<void> {
		this.logger?.info('Calculating derived metrics');

		try {
			// Execute complex SQL query with lateral joins
			// Matches Python lines 547-617 exactly
			await this.sql`
        INSERT INTO template_metrics_derived (
          calculated_at,
          template_id,
          template_name,
          revenue_growth_24h,
          revenue_growth_7d,
          revenue_growth_30d,
          active_projects_change_24h,
          active_projects_change_7d,
          active_projects_change_30d,
          avg_daily_revenue_7d,
          avg_daily_revenue_30d,
          profitability_score
        )
        SELECT
          ${collectedAt}::TIMESTAMPTZ as calculated_at,
          current.template_id,
          current.template_name,
          current.total_payout - COALESCE(prev_24h.total_payout, current.total_payout) as revenue_growth_24h,
          current.total_payout - COALESCE(prev_7d.total_payout, current.total_payout) as revenue_growth_7d,
          current.total_payout - COALESCE(prev_30d.total_payout, current.total_payout) as revenue_growth_30d,
          current.active_projects - COALESCE(prev_24h.active_projects, current.active_projects) as active_change_24h,
          current.active_projects - COALESCE(prev_7d.active_projects, current.active_projects) as active_change_7d,
          current.active_projects - COALESCE(prev_30d.active_projects, current.active_projects) as active_change_30d,
          CASE
            WHEN prev_7d.total_payout IS NOT NULL
            THEN (current.total_payout - prev_7d.total_payout) / 7
            ELSE 0
          END as avg_daily_revenue_7d,
          CASE
            WHEN prev_30d.total_payout IS NOT NULL
            THEN (current.total_payout - prev_30d.total_payout) / 30
            ELSE 0
          END as avg_daily_revenue_30d,
          calculate_profitability_score(
            current.total_payout,
            current.total_payout - COALESCE(prev_30d.total_payout, current.total_payout),
            current.retention_rate,
            current.health
          ) as profitability_score
        FROM template_snapshots current
        LEFT JOIN LATERAL (
          SELECT total_payout, active_projects
          FROM template_snapshots
          WHERE template_id = current.template_id
            AND collected_at >= ${collectedAt}::TIMESTAMPTZ - INTERVAL '24 hours'
            AND collected_at < ${collectedAt}
          ORDER BY collected_at DESC
          LIMIT 1
        ) prev_24h ON true
        LEFT JOIN LATERAL (
          SELECT total_payout, active_projects
          FROM template_snapshots
          WHERE template_id = current.template_id
            AND collected_at >= ${collectedAt}::TIMESTAMPTZ - INTERVAL '7 days'
            AND collected_at < ${collectedAt}
          ORDER BY collected_at DESC
          LIMIT 1
        ) prev_7d ON true
        LEFT JOIN LATERAL (
          SELECT total_payout, active_projects
          FROM template_snapshots
          WHERE template_id = current.template_id
            AND collected_at >= ${collectedAt}::TIMESTAMPTZ - INTERVAL '30 days'
            AND collected_at < ${collectedAt}
          ORDER BY collected_at DESC
          LIMIT 1
        ) prev_30d ON true
        WHERE current.collected_at = ${collectedAt}
      `;

			this.logger?.info('Derived metrics calculated successfully');
		} catch (error) {
			this.logger?.warn(
				{ error },
				'Failed to calculate derived metrics (expected on first run)'
			);
		}
	}

	/**
	 * Close database connection
	 */
	async close(): Promise<void> {
		this.logger?.info('Database connection closed');
	}
}
