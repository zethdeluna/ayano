import { z } from "zod";

export const RegisterBody = z.object({
	email: z.email().max(254), 
	username: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9]+$/), 
	password: z.string().max(1000)
});

export const LoginBody = z.object({
	email: z.string().trim().max(254), 
	password: z.string().max(1000)
});