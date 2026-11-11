import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { createApp } from "./app.js";

const app = createApp();

const server = app.listen(config.PORT, () => {

	console.log(`API listening on http://localhost:${config.PORT}`);

});

async function shutdown() {
	server.close();
	await pool.end();
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

/**
 * For quick tests in terminal: 
 * 	curl [insert endpoint url here]
 * 
 * Example:
 * 	curl http://localhost:3000/api/items/00000000-0000-0000-0000-0000000000d1
 */