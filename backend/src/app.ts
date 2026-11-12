import express from "express";
import cookieParser from "cookie-parser";
import { globalLimiter } from "./middleware/rateLimits.js";
import { pool } from "./db/pool.js";
import { originCheck } from "./middleware/originCheck.js";
import { itemsRouter } from "./routes/items.js";
import { authRouter } from "./routes/auth.js";

export function createApp() {

	const app = express();

	app.disable("x-powered-by");
	app.use(globalLimiter);
	app.use(express.json({ limit: "100kb" }));
	app.use(cookieParser());
	app.use(originCheck);

	// Routes -----------------------

	// Health check
	app.get("/api/health", async (_req, res) => {

		try {
			const result = await pool.query("select 1 AS ok");
			return res.json(result.rows[0]);
		} catch (err) {
			console.error(err);
			res.status(500).json({ error: "Database unavailable" });
		}

	});

	app.use("/api/auth", authRouter);
	app.use("/api/items", itemsRouter);
	

	// Catch-all error
	app.use("/api", (_req, res) => {
		res.status(404).json({ error: "Not found" });
	});

	// Turn thrown errors into safe JSON (needs all four parameters to count as an error handler)
	app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {

		const status = 
			typeof err === "object" && 
			err !== null && 
			"status" in err && 
			typeof err.status === "number" && 
			err.status >= 400 && 
			err.status < 500 
				? err.status 
				: 500
		;

		if ( status === 500 ) console.error(err);

		res.status(status).json({ error: status === 500 ? "Internal server error" : "Bad request" });

	});

	return app;

}