import { pool } from "../db/pool.js";

export async function runCleanup(): Promise<void> {

	const sessions = await pool.query("DELETE FROM sessions WHERE expires_at < now()");
	const tokens = await pool.query(
		`
		DELETE FROM auth_tokens 
		WHERE expires_at < now() - interval '1 day' OR used_at < now() - interval '1 day'
		`
	);
	const users = await pool.query(
		`
		DELETE FROM users 
		WHERE email_verified_at IS NULL AND created_at < now() - interval '7 days'
		`
	);

	const total = (sessions.rowCount ?? 0) + (tokens.rowCount ?? 0) + (users.rowCount ?? 0);
	if ( total > 0 ) {

		console.log(`clean: ${sessions.rowCount} sessions, ${tokens.rowCount} tokens, ${users.rowCount} unverified users`);

	}

}

export function startCleanup(): NodeJS.Timeout {

	const run = () => runCleanup().catch(err => console.error("Cleanup failed", err));

	void run();

	const timer = setInterval(run, 60 * 60 * 1000);
	timer.unref(); // don't keep the process alive just for this 
	return timer;

}