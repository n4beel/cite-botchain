/**
 * Local stack runner and seeder for Cite (Archetype AF · Bibliography).
 *
 * Spawns anvil on port 8727 with chain id 968, deploys Cite, and seeds works:
 * - A citation chain A ← B ← C (Work 1 ← Work 2 ← Work 3)
 * - A work with fee 0 (Work 4)
 * - A self-citing author (Work 5 by Bob citing his own Work 2)
 * - A work cited by 5 others (Work 1 cited by Works 2, 6, 7, 8, 9)
 * - A work with the maximum 8 citations (Work 9 citing Works 1 through 8)
 *
 * Usage:
 *   node scripts/local-stack.mjs
 *   npm run dev
 */

import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  keccak256,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORT = 8727;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;

const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // 0: Alice (Author A)
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // 1: Bob (Author B)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // 2: Charlie (Author C)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // 3: Dave (Author D)
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // 4: Eve (Outsider)
];

const accounts = KEYS.map((k) => privateKeyToAccount(k));

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

try {
  execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
} catch {}

console.log(`Starting anvil on port ${PORT}...`);
spawn(
  "anvil",
  [
    "--port",
    String(PORT),
    "--chain-id",
    String(CHAIN_ID),
    "--accounts",
    "10",
    "--balance",
    "1000",
    "--silent",
  ],
  { detached: true, stdio: "ignore" }
).unref();

const pub = createPublicClient({ chain: local, transport: http() });

for (let i = 0; i < 40; i++) {
  try {
    await pub.getBlockNumber();
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}

const artifact = JSON.parse(
  readFileSync(new URL("../contracts/out/Cite.sol/Cite.json", import.meta.url), "utf8")
);

const wallets = accounts.map((account) =>
  createWalletClient({ account, chain: local, transport: http() })
);

console.log("Deploying Cite contract...");
const deployHash = await wallets[0].deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
});

const deployReceipt = await pub.waitForTransactionReceipt({ hash: deployHash });
const contractAddress = deployReceipt.contractAddress;
const startBlock = deployReceipt.blockNumber;

console.log(`Deployed Cite to ${contractAddress} at block ${startBlock}`);

// Helper to publish with auto-quote
async function publishWork(wallet, title, cites, fee, nonce) {
  const hash = keccak256(toHex(`content-${title}-${nonce}`));
  const required = await pub.readContract({
    address: contractAddress,
    abi: artifact.abi,
    functionName: "quote",
    args: [cites, wallet.account.address],
  });

  const tx = await wallet.writeContract({
    address: contractAddress,
    abi: artifact.abi,
    functionName: "publish",
    args: [hash, title, cites, fee],
    value: required,
  });

  await pub.waitForTransactionReceipt({ hash: tx });
  return hash;
}

console.log("Seeding works...");

// 1. Work 1 (Alice): Root of chain A←B←C, fee 0.05 BOT
console.log("Seeding Work 1: Foundations of Decentralized Graph Computations (Alice)...");
await publishWork(
  wallets[0],
  "Foundations of Decentralized Graph Computations",
  [],
  parseEther("0.05"),
  1
);

// 2. Work 2 (Bob): Cites Work 1 (B cites A), fee 0.10 BOT
console.log("Seeding Work 2: Practical Implementations of Citation Graphs (Bob)...");
await publishWork(
  wallets[1],
  "Practical Implementations of Citation Graphs",
  [1n],
  parseEther("0.10"),
  2
);

// 3. Work 3 (Charlie): Cites Work 2 (C cites B), fee 0.15 BOT -> Completes A←B←C chain
console.log("Seeding Work 3: Empirical Validation of Citation Royalty Flow (Charlie)...");
await publishWork(
  wallets[2],
  "Empirical Validation of Citation Royalty Flow",
  [2n],
  parseEther("0.15"),
  3
);

// 4. Work 4 (Alice): Fee 0 BOT
console.log("Seeding Work 4: Open Access Knowledge Commons Manifesto (Alice, Fee 0)...");
await publishWork(
  wallets[0],
  "Open Access Knowledge Commons Manifesto",
  [],
  0n,
  4
);

// 5. Work 5 (Bob): Bob self-cites his own Work 2, fee 0.02 BOT
console.log("Seeding Work 5: Reflections on Practical Implementations (Bob self-citing Work 2)...");
await publishWork(
  wallets[1],
  "Reflections on Practical Implementations",
  [2n],
  parseEther("0.02"),
  5
);

// 6. Work 6 (Charlie): Cites Work 1, Work 4, Work 5
console.log("Seeding Work 6: Graph Topology in Open Peer Review (Charlie)...");
await publishWork(
  wallets[2],
  "Graph Topology in Open Peer Review",
  [1n, 4n, 5n],
  parseEther("0.08"),
  6
);

// 7. Work 7 (Dave): Cites Work 1, Work 3
console.log("Seeding Work 7: Network Analysis of Academic Lineage on BOT Chain (Dave)...");
await publishWork(
  wallets[3],
  "Network Analysis of Academic Lineage on BOT Chain",
  [1n, 3n],
  parseEther("0.01"),
  7
);

// 8. Work 8 (Eve): Cites Work 1, Work 2, Work 4
console.log("Seeding Work 8: Incentivizing Verifiable Citations in Web3 (Eve)...");
await publishWork(
  wallets[4],
  "Incentivizing Verifiable Citations in Web3",
  [1n, 2n, 4n],
  parseEther("0.04"),
  8
);

// 9. Work 9 (Dave): Cites Works 1 through 8 (Maximum 8 Citations!)
console.log("Seeding Work 9: Comprehensive Taxonomy of Decentralized Scholarship (Max 8 Cites)...");
await publishWork(
  wallets[3],
  "Comprehensive Taxonomy of Decentralized Scholarship",
  [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n],
  parseEther("0.25"),
  9
);

console.log("\nRoles Table:");
console.log("----------------------------------------------------------------------------------------");
console.log("| Role              | Index | Address                                    | Private Key (first 10) |");
console.log("----------------------------------------------------------------------------------------");
console.log(`| Author A (Alice)  | 0     | ${accounts[0].address} | ${KEYS[0].slice(0, 10)}... |`);
console.log(`| Author B (Bob)    | 1     | ${accounts[1].address} | ${KEYS[1].slice(0, 10)}... |`);
console.log(`| Author C (Charlie)| 2     | ${accounts[2].address} | ${KEYS[2].slice(0, 10)}... |`);
console.log(`| Author D (Dave)   | 3     | ${accounts[3].address} | ${KEYS[3].slice(0, 10)}... |`);
console.log(`| Outsider (Eve)    | 4     | ${accounts[4].address} | ${KEYS[4].slice(0, 10)}... |`);
console.log("----------------------------------------------------------------------------------------\n");

console.log("Seeded Works Table:");
console.log("----------------------------------------------------------------------------------------");
console.log("| ID | Title                                          | Author  | Fee       | Cites | CitedBy |");
console.log("----------------------------------------------------------------------------------------");
console.log("| 1  | Foundations of Decentralized Graph Computations| Alice   | 0.05 BOT  | []    | 5       |");
console.log("| 2  | Practical Implementations of Citation Graphs   | Bob     | 0.10 BOT  | [1]   | 3       |");
console.log("| 3  | Empirical Validation of Citation Royalty Flow  | Charlie | 0.15 BOT  | [2]   | 2       |");
console.log("| 4  | Open Access Knowledge Commons Manifesto        | Alice   | Free      | []    | 3       |");
console.log("| 5  | Reflections on Practical Implementations       | Bob     | 0.02 BOT  | [2]   | 2       |");
console.log("| 6  | Graph Topology in Open Peer Review             | Charlie | 0.08 BOT  | [1,4,5]| 1      |");
console.log("| 7  | Network Analysis of Academic Lineage           | Dave    | 0.01 BOT  | [1,3] | 1       |");
console.log("| 8  | Incentivizing Verifiable Citations in Web3     | Eve     | 0.04 BOT  | [1,2,4]| 1      |");
console.log("| 9  | Comprehensive Taxonomy of Decentralized Schol. | Dave    | 0.25 BOT  |[1..8] | 0       |");
console.log("----------------------------------------------------------------------------------------\n");

// Write .env.local
const envContent = [
  `NEXT_PUBLIC_BOTCHAIN_NETWORK=testnet`,
  `NEXT_PUBLIC_BOHR_RPC=${RPC}`,
  `NEXT_PUBLIC_CONTRACT_968=${contractAddress}`,
  `NEXT_PUBLIC_DEPLOY_BLOCK_968=${startBlock}`,
  "",
].join("\n");

writeFileSync(".env.local", envContent);
console.log("Wrote .env.local");
console.log(`\nLocal stack ready on port ${PORT}!`);
