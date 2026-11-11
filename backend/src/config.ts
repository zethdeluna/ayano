import { z } from "zod";

const Env = z.object({
	PORT: z.coerce.number().int().positive().default(3000), 
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"), 
	DATABASE_URL: z.string().min(1), 
	APP_BASE_URL: z.url().transform(s => s.replace(/\/+$/, ""))
});

const parsed = Env.safeParse(process.env);
if ( !parsed.success ) {

	console.error("Invalid environment: ");
	for ( const issue of parsed.error.issues ) {

		console.error(` ${issue.path.join(".")}: ${issue.message}`);

	}

	process.exit(1);

}

export const config = parsed.data;
export const isProd = config.NODE_ENV === "production";