import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE, setSessionCookie, clearSessionCookie } from "../auth/cookie.js";
import { validateSession, type AuthUser } from "../auth/sessions.js";

declare global {
	namespace Express {
		interface Request {
			user?: AuthUser;
		}
	}
}

const TOKEN_LENGTH = 43; // 32 random bytes in base64url

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {

	try {

		const token = req.cookies?.[SESSION_COOKIE];

		if ( typeof token !== "string" || token.length !== TOKEN_LENGTH ) {

			res.status(401).json({ error: "Not signed in" });
			return;

		}

		const session = await validateSession(token);
		if ( !session ) {
			clearSessionCookie(res);
			res.status(401).json({ error: "Not signed in" });
			return;
		}

		if ( session.refreshed ) setSessionCookie(res, token, session.expiresAt);
		req.user = session.user;
		next();

	} catch (err) {
		next(err);
	}

}