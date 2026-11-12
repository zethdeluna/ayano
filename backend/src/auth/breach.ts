import { createHash } from "node:crypto";
import { normalizePassword } from "./password.js";

export async function isBreached(password: string): Promise<boolean> {

	// SHA-1 is only a lookup key for the range API here, not how passwords are stored
	const sha1 = createHash("sha1").update(normalizePassword(password)).digest("hex").toUpperCase();
	const prefix = sha1.slice(0, 5);
	const suffix = sha1.slice(5);

	try {

		const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
			headers: { "Add-Padding": "true" },
			signal: AbortSignal.timeout(2000)
		});

		if ( !res.ok ) {
			console.warn(`Breach check skipped: HTTP ${res.status}`);
			return false;
		}

		const body = await res.text();
		for ( const line of body.split("\n") ) {

			const [lineSuffix, count] = line.trim().split(":");
			if ( lineSuffix === suffix && Number(count) > 0 ) return true;

		}

		return false;

	} catch (err) {

		console.warn("Breach check skipped: ", err);
		return false;

	}

}