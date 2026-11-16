import { config } from "../config.js";
import type { Email } from "./send.js";

export function verifyEmailMessage(to: string, token: string): Email {

	const link = `${config.APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;

	return {
		to, 
		subject: "Confirm your email address", 
		text: [
			"Confirm your email address to finish creating your account:",
			"",
			link,
			"",
			"You will be asked for your password to confirm it is you. The link expires in 24 hours.", 
			"If you did not sign up, you can ignore this email."
		].join("\n")
	};

}

export function alreadyRegisteredMessage(to: string): Email {

	return {
		to,
		subject: "You already have an account", 
		text: [
			"Someone, hopefully you, tried to sign up with this email address, but you already have an account.", 
			"", 
			`Log in: ${config.APP_BASE_URL}/login`, 
			`Forgot your password? ${config.APP_BASE_URL}/forgot-password`, 
			"", 
			"If this was not you, you can ignore this email."
		].join("\n")
	};

}