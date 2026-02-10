import logger from './utils/logger';
import { loadConfig } from './utils/config';
import { RailwayClient } from './railway/client';
import { GaugeDatabase } from './db';

/**
 * Collect metrics from Railway API and persist to database
 * Mirrors functionality of legacy Python script (_legacy/collect_metrics.py)
 */
async function collectMetrics() {
	const startTime = new Date();
	let db: GaugeDatabase | undefined;

	try {
		logger.info({ startTime: startTime.toISOString() }, 'Starting collection');

		// Load and validate configuration
		logger.info('Loading configuration...');
		const config = await loadConfig(logger);
		logger.info('Configuration validated');

		// Initialize database client
		logger.info('Initializing database connection...');
		db = new GaugeDatabase({
			connectionString: config.DATABASE_URL,
			logger,
		});

		// Ensure database schema exists
		await db.ensureSchema();

		// Initialize Railway API client
		logger.info('Initializing Railway API client...');
		const railwayClient = new RailwayClient({
			apiToken: config.RAILWAY_API_TOKEN,
			workspaceId: config.RAILWAY_WORKSPACE_ID,
			logger,
		});

		// Validate credentials first
		logger.info('Validating Railway API credentials...');
		await railwayClient.validateCredentials();

		// Fetch earnings data
		logger.info('Fetching earnings data from Railway...');
		const earnings = await railwayClient.getEarnings();
		logger.info(
			{
				lifetimeEarnings: `$${(earnings.lifetimeEarnings / 100).toFixed(2)}`,
				templateEarnings: `$${(earnings.templateEarningsLifetime / 100).toFixed(2)}`,
				availableBalance: `$${(earnings.availableBalance / 100).toFixed(2)}`,
			},
			'Earnings data fetched',
		);

		// Fetch templates
		logger.info('Fetching template data from Railway...');
		const templates = await railwayClient.getTemplates();
		const totalRevenue = templates.reduce((sum, t) => sum + t.totalPayout, 0);
		const totalActiveProjects = templates.reduce((sum, t) => sum + t.activeProjects, 0);

		logger.info(
			{
				count: templates.length,
				totalRevenue: `$${(totalRevenue / 100).toFixed(2)}`,
				totalActiveProjects,
			},
			'Template data fetched',
		);

		// Persist earnings snapshot
		logger.info('Persisting earnings snapshot to database...');
		await db.insertEarningsSnapshot(earnings, startTime);
		logger.info('Earnings snapshot persisted');

		// Persist template snapshots
		logger.info({ count: templates.length }, 'Persisting template snapshots to database...');
		await db.insertTemplateSnapshots(templates, startTime);
		logger.info({ count: templates.length }, 'Template snapshots persisted');

		// Calculate derived metrics
		logger.info('Calculating derived metrics...');
		await db.calculateDerivedMetrics(startTime);
		logger.info('Derived metrics calculated');

		// Success summary
		const endTime = new Date();
		const duration = (endTime.getTime() - startTime.getTime()) / 1000;

		logger.info({
			collectionTimestamp: startTime.toISOString(),
			executionTime: `${duration.toFixed(2)}s`,
			templatesProcessed: templates.length,
			templateRevenue: `$${(totalRevenue / 100).toFixed(2)}`,
		}, 'METRICS COLLECTION COMPLETED SUCCESSFULLY');

	} catch (error) {
		logger.error({ error }, 'Failed to collect metrics');
		process.exitCode = 1;
	} finally {
		// Clean up database connection
		if (db) {
			await db.close();
		}
	}
}

// Run the collection
collectMetrics();
