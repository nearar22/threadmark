import { createAccount, createClient, isSuccessful } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const rawKey = process.env.GENLAYER_PRIVATE_KEY?.trim();
const secondaryRawKey = process.env.GENLAYER_SECONDARY_PRIVATE_KEY?.trim();
const contract = process.env.CONTRACT_ADDRESS?.trim();
if (!rawKey || !secondaryRawKey || !contract) throw new Error("GENLAYER_PRIVATE_KEY, GENLAYER_SECONDARY_PRIVATE_KEY and CONTRACT_ADDRESS are required");
const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
const secondaryKey = secondaryRawKey.startsWith("0x") ? secondaryRawKey : `0x${secondaryRawKey}`;
const chain = { ...studioDevnet, id: 61997, name: "GenLayer Studio Next", rpcUrls: { default: { http: ["https://studio-next.genlayer.com/api"] } } };
const ownerAccount = createAccount(key);
const authorAccount = createAccount(secondaryKey);
const ownerClient = createClient({ chain, account: ownerAccount });
const authorClient = createClient({ chain, account: authorAccount });
const boardId = process.env.DEMO_BOARD_ID || "threadmark-demo01";
const stewardSample = "0x1509759377876c435914b5394fa83E7391dEfbAc";
const rawUrl = "https://raw.githubusercontent.com/nearar22/intent-lock/f8cc2d08fd4a91b0450d60e065e5c507cdfd7c99/README.md";

async function write(client, label, functionName, args, intelligent = false) {
  const fees = await client.estimateTransactionFees({ leaderTimeunitsAllocation: intelligent ? 300n : 125n, validatorTimeunitsAllocation: intelligent ? 600n : 250n });
  const hash = await client.writeContract({ address: contract, functionName, args, fees });
  console.log(`${label}_TX=${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: "finalized", retries: 240, interval: 3000, fullTransaction: true });
  const status = String(receipt.statusName ?? receipt.status ?? "unknown");
  const execution = String(receipt.txExecutionResultName ?? receipt.txExecutionResult ?? "unknown");
  console.log(`${label}_STATUS=${status};EXECUTION_RESULT=${execution}`);
  if (!isSuccessful(receipt) || status !== "FINALIZED" || execution !== "FINISHED_WITH_RETURN") throw new Error(`${label} did not finalize successfully`);
  return hash;
}

await write(ownerClient, "BOARD", "create_board", [boardId, "An agent claim, traced to its source"]);
await write(ownerClient, "STEWARD_AUTHOR_ADD", "set_author", [boardId, stewardSample, true]);
let board = await ownerClient.readContract({ address: contract, functionName: "get_board", args: [boardId], jsonSafeReturn: true });
if (board.authors?.[0] !== stewardSample.toLowerCase()) throw new Error("Steward sample was not stored canonically");
await write(ownerClient, "STEWARD_AUTHOR_REMOVE", "set_author", [boardId, stewardSample.toLowerCase(), false]);
await write(ownerClient, "AUTHOR_ADD", "set_author", [boardId, authorAccount.address, true]);
board = await ownerClient.readContract({ address: contract, functionName: "get_board", args: [boardId], jsonSafeReturn: true });
if (board.authors?.length !== 1 || board.authors[0] !== authorAccount.address.toLowerCase()) throw new Error("Secondary author was not stored canonically");
await write(authorClient, "AUTHOR_SOURCE", "pin_source", [boardId, "source-intent", rawUrl, 5, 5, "two agents, two request IDs, and two differently worded instructions"], true);
const source = await ownerClient.readContract({ address: contract, functionName: "get_node", args: [boardId, "source-intent"], jsonSafeReturn: true });
if (source.status !== "PINNED" || !source.source?.sha256) throw new Error("Pinned source receipt missing");
if (source.author !== authorAccount.address.toLowerCase()) throw new Error("Authorized author did not create the source node");
await write(authorClient, "SUPPORTED", "derive", [boardId, "claim-paraphrase", ["source-intent"], "Two differently worded requests can be made by two agents."], true);
await write(ownerClient, "BROKEN", "derive", [boardId, "claim-guarantee", ["source-intent"], "Every agent action is guaranteed safe."], true);
const nodes = await ownerClient.readContract({ address: contract, functionName: "list_nodes", args: [boardId], jsonSafeReturn: true });
console.log(`LIVE_STATE=${JSON.stringify(nodes)}`);
if (nodes.length !== 3 || nodes[1].status !== "SUPPORTED" || nodes[2].status !== "BROKEN") throw new Error("Unexpected stored provenance state");
