import type { NextFunction, Request, Response } from "express";

export function requireVerified(req: Request, res: Response, next: NextFunction): void {

	if ( !req.user ) {
		res.status(401).json({ error: "Not signed in" });
		return;
	}

	if ( !req.user.emailVerifiedAt ) {
		res.status(403).json({ error: "Verify your email to continue.", code: "EMAIL_NOT_VERIFIED" });
		return;
	}

	next();

}