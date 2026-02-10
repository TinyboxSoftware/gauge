import type { Logger } from 'pino';
import pino from 'pino';
import z, { parseAsync } from 'zod';

// global config object
const config = {};

// config schema
const configSchema = z.object({
	RAILWAY_API_TOKEN: z.string().min(1, 'Railway API token is required'),

	// reference IDs
	RAILWAY_WORKSPACE_ID: z.string().uuid('Railway workspace ID must be a valid UUID'),

	// database connection string 
	DATABASE_URL: z.string().superRefine((val, ctx) => {
		try {
			const url = new URL(val);

			if (!["postgres:", "postgresql:"].includes(url.protocol)) {
				ctx.addIssue({
					code: 'custom',
					message: "Protocol must be 'postgres:' or 'postgresql:'",
				});
			}

			if (!url.hostname) {
				ctx.addIssue({
					code: 'custom',
					message: "Hostname is required",
				});
			}

			if (!url.pathname || url.pathname === "/") {
				ctx.addIssue({
					code: 'custom',
					message: "Database name is required",
				});
			}

			if (url.port) {
				const port = parseInt(url.port);
				if (port < 1 || port > 65535) {
					ctx.addIssue({
						code: 'custom',
						message: "Port must be between 1 and 65535",
					});
				}
			}
		} catch (error) {
			ctx.addIssue({
				code: 'custom',
				message: "Invalid URL format",
			});
		}
	})
})

type Config = z.infer<typeof configSchema>;

/**
 * loads and validates config.
 * if not, it throws an error 
 */
export const loadConfig = async (parentLogger?: Logger): Promise<Config> => {
	const logger = parentLogger ? parentLogger : pino({ level: 'info' })

	const unsafeConfig = {
		RAILWAY_API_TOKEN: Bun.env.RAILWAY_API_TOKEN,
		RAILWAY_WORKSPACE_ID: Bun.env.RAILWAY_WORKSPACE_ID,
		DATABASE_URL: Bun.env.DATABASE_URL
	}

	// make sure environment passes
	const { data: config, error } = await configSchema.safeParseAsync(unsafeConfig);

	if (error) {
		const errorMessage = `Failed to parse config`;
		logger.error({ error: error }, errorMessage);
		throw new Error(errorMessage);
	}

	return config;
}