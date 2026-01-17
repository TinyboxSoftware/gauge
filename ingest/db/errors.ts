/**
 * Custom error classes for database operations
 */

/**
 * Base error class for all database-related errors
 */
export class DatabaseError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown
	) {
		super(message);
		this.name = 'DatabaseError';

		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

/**
 * Error thrown when schema initialization fails
 */
export class SchemaError extends DatabaseError {
	constructor(message: string, cause?: unknown) {
		super(message, cause);
		this.name = 'SchemaError';
	}
}

/**
 * Error thrown when data insertion fails
 */
export class InsertError extends DatabaseError {
	constructor(message: string, cause?: unknown) {
		super(message, cause);
		this.name = 'InsertError';
	}
}
