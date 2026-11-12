import { pool } from "../db/pool.js";
import { verifyPassword, needsRehash, hashPassword, DUMMY_HASH } from "./password.js";
import type { AuthUser } from "./sessions.js";

export async function checkCredentials(email: string, password: string): Promise<AuthUser | null> {

	const { rows } = await pool.query(
		`
		SELECT 
			id, 
			username, 
			email, 
			email_verified_at, 
			password_hash 
		FROM users 
		WHERE lower(email) = lower($1)
		`, 
		[email]
	);

	const row = rows[0];

	const ok = await verifyPassword(row?.password_hash ?? DUMMY_HASH, password);
	if ( !row || !ok ) return null;

	// Quietly upgrade old hashes after a successful login
	if ( needsRehash(row.password_hash) ) {

		await pool.query(
			"UPDATE users SET password_hash = $1 WHERE id = $2", 
			[await hashPassword(password), row.id]
		);

	}

	return {
		id: row.id, 
		username: row.username, 
		email: row.email, 
		emailVerifiedAt: row.email_verified_at
	};

}