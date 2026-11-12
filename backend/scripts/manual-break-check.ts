import { randomUUID } from "node:crypto";
import { isBreached } from "../src/auth/breach.js";

console.log(await isBreached("password1234567"));
console.log(await isBreached(randomUUID() + randomUUID()));