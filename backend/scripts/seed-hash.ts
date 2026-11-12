import { hashPassword } from "../src/auth/password.js";

for ( const name of ["zeth", "alice", "bob"] ) {
	console.log(`${name}: ${await hashPassword(`dev-password-for-${name}`)}`);
}