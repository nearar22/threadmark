import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const address = process.env.CONTRACT_ADDRESS?.trim();
if (!address) throw new Error("CONTRACT_ADDRESS is required");

const chain = { ...studioDevnet, id: 61997, name: "GenLayer Studio Next", rpcUrls: { default: { http: ["https://studio-next.genlayer.com/api"] } } };
const client = createClient({ chain });
const local = readFileSync(new URL("../../contracts/threadmark.py", import.meta.url), "utf8");
const deployed = await client.getContractCode(address);
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

console.log(`LOCAL_SHA256=${sha256(local)}`);
console.log(`DEPLOYED_SHA256=${sha256(deployed)}`);
console.log(`SOURCE_MATCH=${local === deployed}`);
if (local !== deployed) throw new Error("Deployed source does not match repository source");
