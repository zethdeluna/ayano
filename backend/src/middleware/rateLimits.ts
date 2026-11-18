import type { Request } from "express";
import { rateLimit } from "express-rate-limit";

const emailKey = (req: Request): string => {

	const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
	return email || "no-email";

};

const userKey = (req: Request): string => req.user?.id ?? "anonymous";

// A generous limit so nothing is wide open. 
// Stricter per-endpoint limits arrive with the auth routes
export const globalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	limit: 300, 
	standardHeaders: true, 
	legacyHeaders: false
});

// Per-endpoint rate limits
const rateOpts = { standardHeaders: true, legacyHeaders: false } as const;

export const registerLimiter = rateLimit({
	...rateOpts, 
	windowMs: 60 * 60 * 1000, 
	limit: 5
});

// Counts only failed attempts: a successful login doesn't use up the allowance
export const loginIpLimiter = rateLimit({
	...rateOpts, 
	windowMs: 15 * 60 * 1000, 
	limit: 10, 
	skipSuccessfulRequests: true
});

export const loginEmailLimiter = rateLimit({
	...rateOpts, 
	windowMs: 15 * 60 * 1000, 
	limit: 10, 
	skipSuccessfulRequests: true, 
	keyGenerator: emailKey
});

export const registerEmailLimiter = rateLimit({
	...rateOpts, 
	windowMs: 60 * 60 * 1000, 
	limit: 3, 
	keyGenerator: emailKey
});

export const verifyLimiter = rateLimit({
	...rateOpts, 
	windowMs: 15 * 60 * 1000, 
	limit: 10
});

export const resendMinuteLimiter = rateLimit({
	...rateOpts, 
	windowMs: 60 * 1000, 
	limit: 1, 
	keyGenerator: userKey
});

export const resendDayLimiter = rateLimit({
	...rateOpts, 
	windowMs: 24 * 60 * 60 * 1000, 
	limit: 5, 
	keyGenerator: userKey
});

export const forgotIpLimiter = rateLimit({
	...rateOpts, 
	windowMs: 60 * 60 * 1000, 
	limit: 10
});

export const forgotEmailLimiter = rateLimit({
	...rateOpts, 
	windowMs: 60 * 60 * 1000, 
	limit: 3, 
	keyGenerator: emailKey
});

export const resetLimiter = rateLimit({
	...rateOpts, 
	windowMs: 15 * 60 * 1000, 
	limit: 10
});

export const passwordChangeLimiter = rateLimit({
	...rateOpts, 
	windowMs: 15 * 60 * 1000, 
	limit: 5, 
	skipSuccessfulRequests: true, 
	keyGenerator: userKey
});