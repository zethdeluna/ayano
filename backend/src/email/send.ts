import { config } from "../config.js";

export type Email = { to: string; subject: string; text: string };

export async function sendEmail(email: Email): Promise<void> {

	if ( config.NODE_ENV !== "production" ) {

		console.log(`\n--- EMAIL (dev, not sent) ---\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n-----------------------------\n`);

		return;

	}

	throw new Error("Real email delivery is not configured yet.");

}

// Fire and forget: used after the response is sent, so it can never change that response
export function sendEmailInBackground(email: Email): void {
	void sendEmail(email).catch(err => console.error("Email send failed", err));
}