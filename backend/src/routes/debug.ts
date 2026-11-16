/**
 * TEMPORARY
 * 
 * Delete in Stage 6, when real protected routes exist
 */
import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireVerified } from "../middleware/requireVerified.js";

export const debugRouter = Router();

debugRouter.get("/verified-only", authenticate, requireVerified, (req, res) => {

	res.json({ ok: true, username: req.user?.username });

});