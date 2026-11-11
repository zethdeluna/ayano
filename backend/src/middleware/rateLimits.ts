import { rateLimit } from "express-rate-limit";

// A generous limit so nothing is wide open. 
// Stricter per-endpoint limits arrive with the auth routes
export const globalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	limit: 300, 
	standardHeaders: true, 
	legacyHeaders: false
});