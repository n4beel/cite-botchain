import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { citeAbi } from "@/lib/botchain/abi";
import { quote } from "@/lib/cite";

const PORT = 8627;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;

const localChain = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const ACCOUNTS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Alice
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Bob
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Charlie
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Dave
].map((k) => privateKeyToAccount(k as `0x${string}`));

describe("Cite On-Chain Integration Tests", () => {
  let anvil: ChildProcess;
  let contractAddress: Address;

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC),
  });

  const wallets = ACCOUNTS.map((account) =>
    createWalletClient({
      account,
      chain: localChain,
      transport: http(RPC),
    })
  );

  beforeAll(async () => {
    anvil = spawn("anvil", [
      "--port",
      String(PORT),
      "--chain-id",
      String(CHAIN_ID),
      "--silent",
    ]);

    // Wait for anvil to come online
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        await publicClient.getBlockNumber();
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!ready) throw new Error(`Anvil failed to start on port ${PORT}`);

    // Deploy contract
    const artifactPath = join(process.cwd(), "contracts", "out", "Cite.sol", "Cite.json");
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

    const hash = await wallets[0].deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode.object,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    contractAddress = receipt.contractAddress as Address;
  });

  afterAll(async () => {
    anvil?.kill();
  });

  it("deploys successfully with workCount 0", async () => {
    const count = await publicClient.readContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "workCount",
    });
    expect(count).toBe(0n);
  });

  it("publishes first work without citations", async () => {
    const hash = await wallets[0].writeContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "publish",
      args: [
        "0x1111111111111111111111111111111111111111111111111111111111111111",
        "Foundational Graph Theory",
        [],
        parseEther("0.05"),
      ],
      value: 0n,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");

    const w1 = await publicClient.readContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "workOf",
      args: [1n],
    });
    expect(w1.author.toLowerCase()).toBe(ACCOUNTS[0].address.toLowerCase());
    expect(w1.fee).toBe(parseEther("0.05"));
    expect(w1.citedBy).toBe(0);
  });

  it("publishes citing work 1 and splits payment", async () => {
    // Quote payment for Bob citing work 1
    const quoteOwed = await publicClient.readContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "quote",
      args: [[1n], ACCOUNTS[1].address],
    });
    expect(quoteOwed).toBe(parseEther("0.05"));

    const hash = await wallets[1].writeContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "publish",
      args: [
        "0x2222222222222222222222222222222222222222222222222222222222222222",
        "Applications of Citation Networks",
        [1n],
        parseEther("0.10"),
      ],
      value: quoteOwed,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    // Alice should have 0.05 ether pending
    const alicePending = await publicClient.readContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "pending",
      args: [ACCOUNTS[0].address],
    });
    expect(alicePending).toBe(parseEther("0.05"));

    // Work 1 citedBy should be 1
    const w1 = await publicClient.readContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "workOf",
      args: [1n],
    });
    expect(w1.citedBy).toBe(1);
  });

  it("handles self-citation with 0 fee", async () => {
    // Alice publishes work 3 citing work 1 (her own)
    const quoteOwed = await publicClient.readContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "quote",
      args: [[1n], ACCOUNTS[0].address],
    });
    expect(quoteOwed).toBe(0n);

    const hash = await wallets[0].writeContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "publish",
      args: [
        "0x3333333333333333333333333333333333333333333333333333333333333333",
        "Foundational Graph Theory Addendum",
        [1n],
        parseEther("0.02"),
      ],
      value: 0n,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    // Alice pending should still be 0.05 (unchanged by self-cite)
    const alicePending = await publicClient.readContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "pending",
      args: [ACCOUNTS[0].address],
    });
    expect(alicePending).toBe(parseEther("0.05"));

    // Work 1 citedBy incremented to 2
    const w1 = await publicClient.readContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "workOf",
      args: [1n],
    });
    expect(w1.citedBy).toBe(2);
  });

  it("reverts on wrong payment", async () => {
    // Charlie attempts to cite work 2 (Bob's fee is 0.10) with 0.05 payment
    await expect(
      wallets[2].writeContract({
        address: contractAddress,
        abi: citeAbi,
        functionName: "publish",
        args: [
          "0x4444444444444444444444444444444444444444444444444444444444444444",
          "Charlie Underpayment",
          [2n],
          0n,
        ],
        value: parseEther("0.05"),
      })
    ).rejects.toThrow();
  });

  it("reverts on duplicate citation ID", async () => {
    await expect(
      wallets[2].writeContract({
        address: contractAddress,
        abi: citeAbi,
        functionName: "publish",
        args: [
          "0x4444444444444444444444444444444444444444444444444444444444444444",
          "Charlie Duplicate Cites",
          [1n, 1n],
          0n,
        ],
        value: parseEther("0.10"),
      })
    ).rejects.toThrow();
  });

  it("reverts on duplicate content hash", async () => {
    await expect(
      wallets[2].writeContract({
        address: contractAddress,
        abi: citeAbi,
        functionName: "publish",
        args: [
          "0x1111111111111111111111111111111111111111111111111111111111111111", // already published as work 1
          "Plagiarized",
          [],
          0n,
        ],
        value: 0n,
      })
    ).rejects.toThrow();
  });

  it("allows authors to withdraw pending royalties", async () => {
    const balBefore = await publicClient.getBalance({ address: ACCOUNTS[0].address });

    const hash = await wallets[0].writeContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "withdraw",
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
    const balAfter = await publicClient.getBalance({ address: ACCOUNTS[0].address });

    expect(balAfter).toBe(balBefore + parseEther("0.05") - gasUsed);

    const pendingNow = await publicClient.readContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "pending",
      args: [ACCOUNTS[0].address],
    });
    expect(pendingNow).toBe(0n);
  });

  it("queries latest works batch", async () => {
    const [list, ids] = await publicClient.readContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "latest",
      args: [0n, 10n],
    });

    expect(list.length).toBe(3);
    expect(ids.length).toBe(3);
    expect(ids[0]).toBe(3n);
    expect(ids[1]).toBe(2n);
    expect(ids[2]).toBe(1n);
  });

  it("queries works by author", async () => {
    const aliceIds = await publicClient.readContract({
      address: contractAddress,
      abi: citeAbi,
      functionName: "byAuthor",
      args: [ACCOUNTS[0].address],
    });

    expect(aliceIds.length).toBe(2);
    expect(aliceIds[0]).toBe(1n);
    expect(aliceIds[1]).toBe(3n);
  });
});
