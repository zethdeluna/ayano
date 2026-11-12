import argon2 from "argon2";

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

// The same normalization wherever a password is checked, hashed, or verified
export const normalizePassword = (password: string) => password.normalize("NFKC");

export function checkPasswordPolicy(raw: string): string | null {

	// code points, not UTF-16 units
	const length = [...normalizePassword(raw)].length;

	if ( length < PASSWORD_MIN_LENGTH ) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
	if ( length > PASSWORD_MAX_LENGTH ) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;

	return null;

}

export const HASH_OPTIONS = {
	type: argon2.argon2id,
	memoryCost: 19456, // KiB = 19MiB, raise after benchmarking
	timeCost: 2, 
	parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
	return argon2.hash(normalizePassword(password), HASH_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {

	try {
		return await argon2.verify(hash, normalizePassword(password));
	} catch {
		// malformed hash, such as the old 'x' seed values
		return false;
	}

}

export function needsRehash(hash: string): boolean {
	return argon2.needsRehash(hash, HASH_OPTIONS);
}

// Computed once at startup. Used so unknown emails cost the same time as wrong passwords.
export const DUMMY_HASH = await hashPassword("dummy-password-for-timing");