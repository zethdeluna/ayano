import type { Request } from "express";
import { rateLimit } from "express-rate-limit";

// A generous limit so nothing is wide open. 
// Stricter per-endpoint limits arrive with the auth routes
export const globalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	limit: 300, 
	standardHeaders: true, 
	legacyHeaders: false
});

// Per-endpoint rate limits
const common = { standardHeaders: true, legacyHeaders: false } as const;

export const registerLimiter = rateLimit({
	...common, 
	windowMs: 60 * 60 * 1000, 
	limit: 5
});

// Counts only failed attempts: a successful login doesn't use up the allowance
export const loginIpLimiter = rateLimit({
	...common, 
	windowMs: 15 * 60 * 1000, 
	limit: 10, 
	skipSuccessfulRequests: true
});

const emailKey = (req: Request): string => {

	const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
	return email || "no-email";

};

export const loginEmailLimiter = rateLimit({
	...common, 
	windowMs: 15 * 60 * 1000, 
	limit: 10, 
	skipSuccessfulRequests: true, 
	keyGenerator: emailKey
});