import assert from "node:assert/strict";
import argon2 from "argon2";
import { hashPassword, verifyPassword, checkPasswordPolicy, needsRehash, DUMMY_HASH } from "../src/auth/password.js";

const pw = "correct horse battery staple";
const h1 = await hashPassword(pw);
const h2 = await hashPassword(pw);

// Hashing
assert.notEqual(h1, h2); // random salt
assert.ok(h1.startsWith("$argon2id$"));
assert.equal(await verifyPassword(h1, pw), true);
assert.equal(await verifyPassword(h1, "wrong password"), false);
assert.equal(await verifyPassword("x", pw), false); // malformed hash: false, not a throw
assert.equal(await verifyPassword(DUMMY_HASH, pw), false);

// Policy
assert.notEqual(checkPasswordPolicy("a".repeat(14)), null);
assert.equal(checkPasswordPolicy("a".repeat(15)), null);
assert.notEqual(checkPasswordPolicy("a".repeat(129)), null);
assert.equal(checkPasswordPolicy("🙂".repeat(15)), null); // 15 code points, 30 UTF-16 units
assert.notEqual(checkPasswordPolicy("🙂".repeat(14)), null);
const passphrase = "correct horse battery staple 🙂 ".repeat(3); // long, with spaces and an emoji
assert.equal(checkPasswordPolicy(passphrase), null);
assert.equal(await verifyPassword(await hashPassword(passphrase), passphrase), true);

// Normalization: composed and decomposed forms of the same text must match
const composed = "caf\u00e9 caf\u00e9 caf\u00e9 caf\u00e9";
assert.equal(await verifyPassword(await hashPassword(composed), composed.normalize("NFD")), true);

// Rehash detection
const weak = await argon2.hash(pw, { type: argon2.argon2id, memoryCost: 8192, timeCost: 2, parallelism: 1 });
assert.equal(needsRehash(weak), true);
assert.equal(needsRehash(h1), false);

// Timing: the unknown-email path should cost about the same as a wrong password
const t1 = performance.now();
await verifyPassword(h1, "wrong");
const wrong = performance.now() - t1;

const t2 = performance.now();
await verifyPassword(DUMMY_HASH, "wrong");
const dummy = performance.now() - t2;

console.log(`wrong password: ${wrong.toFixed(0)} ms, dummy hash: ${dummy.toFixed(0)} ms`);
console.log("all password checks passed");