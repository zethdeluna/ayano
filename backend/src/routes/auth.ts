import { Router } from "express";
import { pool } from "../db/pool.js";
import { RegisterBody, LoginBody } from "../schemas/auth.js";
import { checkPasswordPolicy, hashPassword } from "../auth/password.js";
import { isBreached } from "../auth/breach.js";
import { checkCredentials } from "../auth/credentials.js";
import { createSession, invalidateSession, type AuthUser } from "../auth/sessions.js";
import { SESSION_COOKIE, setSessionCookie, clearSessionCookie } from "../auth/cookie.js";
import { authenticate } from "../middleware/authenticate.js";
import { 
	registerLimiter, 
	loginIpLimiter, 
	loginEmailLimiter, 
	registerEmailLimiter, 
	verifyLimiter, 
	resendMinuteLimiter, 
	resendDayLimiter 
} from "../middleware/rateLimits.js";
import { withTransaction } from "../db/pool.js";
import { issueToken, findTokenOwner, consumeToken } from "../auth/tokens.js";
import { verifyPassword, DUMMY_HASH } from "../auth/password.js";
import { VerifyEmailBody } from "../schemas/auth.js";
import { sendEmailInBackground } from "../email/send.js";
import { verifyEmailMessage, alreadyRegisteredMessage } from "../email/templates.js";

export const authRouter = Router();

const publicUser = (u: AuthUser) => ({
	id: u.id, 
	username: u.username, 
	email: u.email, 
	emailVerified: u.emailVerifiedAt !== null
});

function isUniqueViolation(err: unknown): err is { code: string; constraint?: string } {
	return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "23505";
}

const UPSERT_USER_SQL = `
	INSERT INTO users (email, username, password_hash) 
	VALUES ($1, $2, $3) 
	ON CONFLICT ((lower(email))) DO UPDATE 
		SET username = EXCLUDED.username, 
			password_hash = EXCLUDED.password_hash, 
			created_at = now() 
		WHERE users.email_verified_at IS NULL 
	RETURNING id
`;

// POST /api/auth/register
authRouter.post("/register", registerLimiter, async (req, res, next) => {

	try {

		const parsed = RegisterBody.safeParse(req.body);
		if ( !parsed.success ) {

			res.status(400).json({
				error: "Please check the form.", 
				issues: parsed.error.issues.map(i => ({ field: i.path.join("."), message: i.message }))
			});

			return;

		}

		const { email, username, password } = parsed.data;

		const policyError = checkPasswordPolicy(password);
		if ( policyError ) {

			res.status(400).json({ error: policyError });
			return;

		}

		if ( await isBreached(password) ) {

			res.status(400).json({ error: "That password appears in known data breaches. Choose another." });
			return;

		}

		// Hashed in every case, so response time doesn't reveal whether the email exists.
		const passwordHash = await hashPassword(password);

		let token: string | null;

		try {

			token = await withTransaction(async (client) => {

				const { rows } = await client.query(UPSERT_USER_SQL, [email, username, passwordHash]);
				const row = rows[0];

				// the email belongs to a verified account, nothing was changed
				if ( !row ) return null;

				// New user or overwritten unverified user, kill any session and link from an earlier registration
				await client.query("DELETE FROM sessions WHERE user_id = $1", [row.id]);
				return issueToken(client, row.id, "verify_email");

			});

		} catch (err) {

			if ( isUniqueViolation(err) && err.constraint === "users_username_unique" ) {

				res.status(409).json({ error: "That username is taken." });
				return;

			}

			throw err;

		}

		// Same response in every case
		// The email goes out after the commit and cannot change it
		res.status(202).json({ message: "Check your email to finish signing up." });
		sendEmailInBackground(token ? verifyEmailMessage(email, token) : alreadyRegisteredMessage(email));

	} catch (err) {
		next(err);
	}

});

// POST /api/auth/login
authRouter.post("/login", loginIpLimiter, loginEmailLimiter, async (req, res, next) => {

	try {

		const parsed = LoginBody.safeParse(req.body);
		if ( !parsed.success ) {

			res.status(400).json({ error: "Email and password are required." });
			return;

		}

		const user = await checkCredentials(parsed.data.email, parsed.data.password);
		if ( !user ) {

			res.status(401).json({ error: "Invalid email or password." });
			return;

		}

		// Never reuse a session across a login: drop any old one, then issue a fresh token
		const oldToken = req.cookies?.[SESSION_COOKIE];
		if ( typeof oldToken === "string" ) await invalidateSession(oldToken);

		const { token, expiresAt } = await createSession(user.id);
		setSessionCookie(res, token, expiresAt);
		res.json({ user: publicUser(user) });

	} catch (err) {
		next(err);
	}

});

// POST /api/auth/logout
authRouter.post("/logout", async (req, res, next) => {

	try {

		const token = req.cookies?.[SESSION_COOKIE];

		if ( typeof token === "string" ) await invalidateSession(token);
		clearSessionCookie(res);
		res.status(204).end();

	} catch (err) {
		next(err);
	}

});

// POST /api/auth/verify-email
authRouter.post("/verify-email", verifyLimiter, async (req, res, next) => {

	const FAILED_VERIF_RES = "The link or password is not valid.";

	try {

		const parsed = VerifyEmailBody.safeParse(req.body);
		if ( !parsed.success ) {

			res.status(400).json({ error: FAILED_VERIF_RES });
			return;

		}

		const { token, password } = parsed.data;

		// Whose link is this? (read-only)
		const owner = await findTokenOwner(token, "verify_email");

		// Always verify once, so a bad link costs the same as a bad password
		const passwordOk = await verifyPassword(owner?.passwordHash ?? DUMMY_HASH, password);
		if ( !owner || !passwordOk ) {

			res.status(400).json({ error: FAILED_VERIF_RES });
			return;

		}

		// Consume the link and verify the account together
		const verified = await withTransaction(async (client) => {

			const userId = await consumeToken(client, token, "verify_email");
			if ( !userId ) return false;

			await client.query(
				"UPDATE users SET email_verified_at = now() WHERE id = $1 AND email_verified_at IS NULL",
				[userId]
			);

			return true;

		});

		if ( !verified ) {

			res.status(400).json({ error: FAILED_VERIF_RES });
			return;

		}

		res.json({ message: "Email confirmed. You can log in." });

	} catch (err) {
		next(err);
	}

});

// POST /api/auth/resend-verification
authRouter.post("/resend-verification", authenticate, resendMinuteLimiter, resendDayLimiter, async (req, res, next) => {

	try {

		const user = req.user;
		if ( !user ) {
			res.status(401).json({ error: "Not signed in" });
			return;
		}

		if ( user.emailVerifiedAt ) {
			res.json({ alreadyVerified: true });
			return;
		}

		const token = await withTransaction(client => issueToken(client, user.id, "verify_email"));
		res.status(202).json({ message: "Check your email." });
		sendEmailInBackground(verifyEmailMessage(user.email, token));

	} catch (err) {
		next(err);
	}

});

// GET /api/auth/me
authRouter.get("/me", authenticate,  async (req, res, next) => {

	try {

		if ( !req.user ) {
			res.status(404).json({ error: "Not signed in." });
			return;
		}

		const { rows } = await pool.query(
			`
			SELECT
				w.id, 
				w.name, 
				m.role 
			FROM workspace_members m 
			JOIN workspaces w ON w.id = m.workspace_id 
			WHERE m.user_id = $1 
			ORDER BY w.name
			`,
			[req.user.id]
		);

		res.json({ user: publicUser(req.user), memberships: rows });

	} catch (err) {
		next(err);
	}

});