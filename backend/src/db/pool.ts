import pg from "pg";
import { config } from "../config.js";
import type { PoolClient } from "pg";

// Return calendar dates (type 1082) as plain "YYYY-MM-DD" strings, not JS Dates
pg.types.setTypeParser(1082, (value: string) => value);

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

// Without a listener, an error on an idle connection would crash the process
pool.on("error", err => console.error("Unexpected database error", err));

// Transaction helper
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {

	const client = await pool.connect();

	try {

		await client.query("BEGIN");
		const result = await fn(client);
		await client.query("COMMIT");
		return result;

	} catch (err) {

		try {
			await client.query("ROLLBACK");
		} catch (rollbackErr) {
			console.error("Rollback failed", rollbackErr);
		}

		throw err;

	} finally {

		client.release();

	}

}