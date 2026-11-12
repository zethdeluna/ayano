import type { Response } from "express";
import { isProd } from "../config.js";

// The __Host- prefix requires Secure, which needs HTTPS, so it is production-only
export const SESSION_COOKIE = isProd ? "__Host-session" : "session";

const baseOptions = {
	httpOnly: true, // JavaScript can't read it, so XSS can't steal
	secure: isProd, // HTTPS only in production
	sameSite: "lax" as const,
	path: "/"
};

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
	res.cookie(SESSION_COOKIE, token, { ...baseOptions, expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
	// Must repeat the same path and flags, or the browser treats it as a different cookie
	// and will fail to end the sessoin.
	res.clearCookie(SESSION_COOKIE, baseOptions);
}