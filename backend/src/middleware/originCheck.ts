import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

const allowedOrigin = new URL(config.APP_BASE_URL).origin;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function originCheck(req: Request, res: Response, next: NextFunction): void {

	if ( SAFE_METHODS.has(req.method) ) {

		next();
		return;

	}

	const origin = req.get("origin");
	if ( origin !== undefined && origin !== allowedOrigin ) {

		res.status(403).json({ error: "Forbidden" });
		return;
		
	}

	next();

}