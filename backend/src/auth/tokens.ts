import { randomBytes, createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";

export type TokenPurpose = "verify_email" | "reset_password";
export const TOKEN_LENGTH = 43; // 32 random bytes in base64url

const MINUTE = 60 * 1000;
const LIFETIME_MS: Record<TokenPurpose, number> = {
	verify_email: 24 * 60 * MINUTE,
	reset_password: 30 * MINUTE
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Runs inside the caller's transaction, so a rollback discards the new token too
export async function issueToken(client: PoolClient, userId: string, purpose: TokenPurpose): Promise<string> {

	await client.query(
		"DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL",
		[userId, purpose]
	);

	const token = randomBytes(32).toString("base64url");

	await client.query(
		"INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at) VALUES ($1, $2, $3, $4)",
		[hashToken(token), userId, purpose, new Date(Date.now() + LIFETIME_MS[purpose])]
	);

	return token;

}

// Read-only: whose link is this? Does NOT consume it. 
export async function findTokenOwner(token: string, purpose: TokenPurpose) {

	const { rows } = await pool.query(
		`
		SELECT 
			t.user_id, 
			u.password_hash 
		FROM auth_tokens t
		JOIN users u ON u.id = t.user_id 
		WHERE t.token_hash = $1 
			AND t.purpose = $2 
			AND t.used_at IS NULL 
			AND t.expires_at > now()
		;
		`,
		[hashToken(token), purpose]
	);

	const row = rows[0];

	return row ? { userId: row.user_id as string, passwordHash: row.password_hash as string } : null;

}

// Atomic: for a given token, only one caller can ever get a user id back
export async function consumeToken(client: PoolClient, token: string, purpose: TokenPurpose): Promise<string | null> {

	const { rows } = await client.query(
		`
		UPDATE auth_tokens SET used_at = now() 
		WHERE token_hash = $1 
			AND purpose = $2 
			AND used_at IS NULL
			AND expires_at > now() 
		RETURNING user_id
		;
		`,
		[hashToken(token), purpose]
	);

	return rows[0]?.user_id ?? null;

}