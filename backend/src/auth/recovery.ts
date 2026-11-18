import { pool, withTransaction } from "../db/pool.js";
import { issueToken } from "./tokens.js";
import { sendEmailInBackground } from "../email/send.js";
import { resetPasswordMessage } from "../email/templates.js";

// Runs AFTER the HTTP response, so nothing here can change what the caller sees or how long it takes
export async function requestPasswordReset(email: string): Promise<void> {

	const { rows } = await pool.query(
		"SELECT id, email FROM users WHERE lower(email) = lower($1)", 
		[email]
	);

	const user = rows[0];
	if ( !user ) return;

	// Verified or not: a reset link proves inbox control either way
	const token = await withTransaction(client => issueToken(client, user.id, "reset_password"));
	sendEmailInBackground(resetPasswordMessage(user.email, token));

}