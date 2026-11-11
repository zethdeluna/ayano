import argon2 from "argon2";

export const HASH_OPTIONS = {
	type: argon2.argon2id,
	memoryCost: 19456, // KiB = 19MiB, raise after benchmarking
	timeCost: 2, 
	parallelism: 1,
} as const;

// Create a hash for a password
export function hashPassword(password: string): Promise<string> {
	return argon2.hash(password.normalize("NFKC"), HASH_OPTIONS);
}

// Verify that an entered password is associated with a hash
export async function verifyPassword(hash: string, password: string): Promise<boolean> {

	try {
		return await argon2.verify(hash, password.normalize("NFKC"));
	} catch {
		return false;
	}

}

// Check if a hash is "outdated"
export function needsRehash(hash: string): boolean {
	return argon2.needsRehash(hash, HASH_OPTIONS);
}

// Computed once at startup. Used so unknown emails cost the same time as wrong passwords.
export const DUMMY_HASH = await hashPassword("dummy-password-for-timing");

// For new passwords, check if entry is valid (fits NIST standards)
export function checkPasswordPolicy(raw: string): string | null {

	const length = [...raw.normalize("NFKC")].length;

	if ( length < 15 ) return "Use at least 15 characters.";
	if ( length > 128 ) return "Use at most 128 characters.";
	return null;

}