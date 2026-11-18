import { z } from "zod";
import { TOKEN_LENGTH } from "../auth/tokens.js";

export const RegisterBody = z.object({
	email: z.email().max(254), 
	username: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9]+$/), 
	password: z.string().max(1000)
});

export const LoginBody = z.object({
	email: z.string().trim().max(254), 
	password: z.string().max(1000)
});

export const VerifyEmailBody = z.object({
	token: z.string().length(TOKEN_LENGTH), 
	password: z.string().min(1).max(1000)
});

export const ForgotPasswordBody = z.object({
	email: z.string().trim().min(1).max(254)
});

export const ResetPasswordBody = z.object({
	token: z.string().length(TOKEN_LENGTH), 
	password: z.string().max(1000)
});

export const ChangePasswordBody = z.object({
	currentPassword: z.string().min(1).max(1000), 
	newPassword: z.string().max(1000)
});