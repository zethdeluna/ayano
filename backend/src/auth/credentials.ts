import type { PoolClient } from "pg";
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

// Runs inside the caller's transaction.
// Returns the account's email, for the "password changed" notice.
export async function replacePassword(
	client: PoolClient, 
	userId: string, 
	newHash: string, 
	opts: { markVerified: boolean } 
): Promise<string> {

	const { rows } = await client.query(
		`
		UPDATE users
		SET password_hash = $2, 
			email_verified_at = CASE WHEN $3::boolean THEN COALESCE(email_verified_at, now()) ELSE email_verified_at END
		WHERE id = $1 
		RETURNING email
		`,
		[userId, newHash, opts.markVerified]
	);

	const email: string | undefined = rows[0]?.email;
	if ( !email ) throw new Error("User not found while replacing password.");

	// Whoever knew the old password, or held a session made with it, is locked out
	await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);

	// Any unused verification or reset link is stale now
	await client.query("DELETE FROM auth_tokens WHERE user_id = $1 AND used_at IS NULL", [userId]);

	return email;
	
}