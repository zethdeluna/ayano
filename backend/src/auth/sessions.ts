import { randomBytes, createHash } from "node:crypto";
import { pool } from "../db/pool.js";

export type AuthUser = {
	id: string;
	username: string;
	email: string;
	emailVerifiedAt: string;
};

const DAY = 24 * 60 * 60 * 1000;
const LIFETIME = 30 * DAY;
const REFRESH_WHEN_LEFT = 15 * DAY;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {

	const token = randomBytes(32).toString("base64url");
	const expiresAt = new Date(Date.now() + LIFETIME);

	await pool.query(
		"INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", 
		[hashToken(token), userId, expiresAt]
	);

	return { token, expiresAt };

}

export async function validateSession(token: string) {

	const id = hashToken(token);
	const { rows } = await pool.query(
		`
		SELECT 
			s.expires_at, 
			u.id					AS user_id, 
			u.username, 
			u.email, 
			u.email_verified_at
		FROM sessions s 
		JOIN users u ON u.id = s.user_id 
		WHERE s.id = $1
		`,
		[id]
	);

	const row = rows[0];
	if ( !row ) return null;

	// Expired sessions
	if ( row.expires_at.getTime() <= Date.now() ) {

		await pool.query("DELETE FROM sessions WHERE id = $1", [id]);
		return null;

	}

	// Sliding expiry: extend once less than half the lifetime remains
	let expiresAt: Date = row.expires_at;
	let refreshed = false;
	if ( expiresAt.getTime() - Date.now() < REFRESH_WHEN_LEFT ) {

		expiresAt = new Date(Date.now() + LIFETIME);
		await pool.query("UPDATE sessions SET expires_at = $1 WHERE id = $2", [expiresAt, id]);
		refreshed = true;

	}

	const user: AuthUser = {
		id: row.user_id, 
		username: row.username, 
		email: row.email, 
		emailVerifiedAt: row.email_verified_at
	};

	return { user, expiresAt, refreshed };

}

export async function invalidateSession(token: string): Promise<void> {

	await pool.query("DELETE FROM sessions WHERE id = $1", [hashToken(token)]);

}