import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve("src/database/migrations");
const destination = resolve("dist/database/migrations");

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, force: true });
console.log("[BUILD] Fichiers SQL de migration copiés dans dist/database/migrations.");
