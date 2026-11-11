import pg from "pg";
import { config } from "../config.js";

// Return calendar dates (type 1082) as plain "YYYY-MM-DD" strings, not JS Dates
pg.types.setTypeParser(1082, (value: string) => value);

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

// Without a listener, an error on an idle connection would crash the process
pool.on("error", err => console.error("Unexpected database error", err));