import pino from 'pino';

const logger = pino({
	level: Bun.env.LOG_LEVEL || 'info',
});

export default logger;