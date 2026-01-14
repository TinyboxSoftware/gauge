import logger from './utils/logger';
import { loadConfig } from './utils/config';
import { RailwayClient } from './railway/client';

/**
 * Collect metrics from Railway API
 */
async function collectMetrics() {
  try {
    logger.info('Starting Railway metrics collection');

    // Load and validate configuration
    const config = await loadConfig(logger);

    // Initialize Railway API client
    const railwayClient = new RailwayClient({
      apiToken: config.RAILWAY_API_TOKEN,
      customerId: config.RAILWAY_CUSTOMER_ID,
      workspaceId: config.RAILWAY_WORKSPACE_ID,
      logger,
    });

    // Validate credentials first
    await railwayClient.validateCredentials();

    // Fetch earnings data
    const earnings = await railwayClient.getEarnings();
    logger.info(
      {
        lifetimeEarnings: earnings.lifetimeEarnings / 100,
        templateEarnings: earnings.templateEarningsLifetime / 100,
        availableBalance: earnings.availableBalance / 100,
      },
      'Earnings data fetched',
    );

    // Fetch templates
    const templates = await railwayClient.getTemplates();
    logger.info(
      {
        count: templates.length,
        totalRevenue: templates.reduce((sum, t) => sum + t.totalPayout, 0) / 100,
        totalActiveProjects: templates.reduce((sum, t) => sum + t.activeProjects, 0),
      },
      'Templates data fetched',
    );

    logger.info('Metrics collection completed successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to collect metrics');
    process.exit(1);
  }
}

// Run the collection
collectMetrics();
