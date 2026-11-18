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

export function resetPasswordMessage(to: string, token: string): Email {

	const link = `${config.APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;

	const date = new Date(Date.now());
	const formattedDate = new Intl.DateTimeFormat('en-US', {
		month: 'short', 
		day: 'numeric', 
		year: 'numeric', 
		hour: 'numeric', 
		minute: '2-digit'
	}).format(date);

	return {
		to, 
		subject: "Reset your password", 
		text: [
			`Someone asked to reset the password for this account at ${formattedDate}. To choose a new one, open:`,
			"",
			link, 
			"", 
			"The link expires in 30 minutes and works once.", 
			"If you did not ask for this, ignore this email. Your password has not changed."
		].join("\n")
	};

}

export function passwordChangedMessage(to: string): Email {

	return {
		to, 
		subject: "Your password was changed", 
		text: [
			"The password for your account was just changed, and you have been signed out everywhere.", 
			"", 
			`If this was you, no action is needed. If it was not, reset your password now: ${config.APP_BASE_URL}/forgot-password`
		].join("\n")
	};

}