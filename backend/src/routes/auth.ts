import { Router } from "express";
import { pool } from "../db/pool.js";
import { RegisterBody, LoginBody } from "../schemas/auth.js";
import { checkPasswordPolicy, hashPassword } from "../auth/password.js";
import { isBreached } from "../auth/breach.js";
import { checkCredentials } from "../auth/credentials.js";
import { createSession, invalidateSession, type AuthUser } from "../auth/sessions.js";
import { SESSION_COOKIE, setSessionCookie, clearSessionCookie } from "../auth/cookie.js";
import { authenticate } from "../middleware/authenticate.js";
import { registerLimiter, loginIpLimiter, loginEmailLimiter } from "../middleware/rateLimits.js";

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

		// Check password
		const policyError = checkPasswordPolicy(password);
		if ( policyError ) {

			res.status(400).json({ error: policyError });
			return;

		}

		if ( await isBreached(password) ) {

			res.status(400).json({ error: "That password appears in known data breaches." });
			return;

		}

		// Hash even if the email turns out to exist, so response time doesn't reveal that
		const passwordHash = await hashPassword(password);

		// Create new user
		try {

			await pool.query(
				"INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3)", 
				[email, username, passwordHash]
			);

			// In Stage 4: create a verify_email token and email the link

		} catch (err) {

			if ( !isUniqueViolation(err) ) throw err;
			if ( err.constraint === "users_username_unique" ) {

				res.status(409).json({ error: "That username is taken." });
				return;

			}

			// If email is already registered: fall through to the same response as a new signup.
			// Stage 4 decides what to email

		}

		res.status(202).json({ message: "Check your email to finish signing up." });

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