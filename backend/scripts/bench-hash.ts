import { hashPassword, verifyPassword, HASH_OPTIONS } from "../src/auth/password.js";

console.log("options: ", HASH_OPTIONS);

const runs = 7;
const times: number[] = [];
let hash = "";

for ( let i = 0; i < runs; i++ ) {

	const start = performance.now();
	hash = await hashPassword("benchmark-password-123");
	times.push(performance.now() - start);

}

times.sort((a, b) => a - b);

console.log(
	"hash ms (min / median / max):", 
	times[0]?.toFixed(0), 
	times[Math.floor(runs / 2)]?.toFixed(0), 
	times[runs - 1]?.toFixed(0)
);

const t = performance.now();

await verifyPassword(hash, "benchmark-password-123");

console.log("verify ms: ", (performance.now() - t).toFixed(0));