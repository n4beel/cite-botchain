import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import {
  sha256Buffer,
  quote,
  refLabel,
  formatFee,
  truncateHash,
  foldCitedBy,
} from "../cite";
import { describeError } from "../errors";
import { MAX_CITES, MAX_FEE, MAX_TITLE, MAX_BATCH_VIEW } from "../limits";
import type { PublishedEvent } from "../logs";

describe("Cite domain logic", () => {
  describe("sha256Buffer", () => {
    it("hashes empty buffer to known sha256 vector", async () => {
      const empty = new Uint8Array(0).buffer;
      const hash = await sha256Buffer(empty);
      expect(hash).toBe(
        "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );
    });

    it("hashes ASCII string 'hello' correctly", async () => {
      const buffer = new TextEncoder().encode("hello").buffer;
      const hash = await sha256Buffer(buffer);
      // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
      expect(hash).toBe(
        "0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
      );
    });
  });

  describe("quote", () => {
    const works = new Map([
      [1n, { author: "0xAlice000000000000000000000000000000000001", fee: parseEther("0.05") }],
      [2n, { author: "0xBob00000000000000000000000000000000000002", fee: parseEther("0.10") }],
      [3n, { author: "0xCharlie00000000000000000000000000000000003", fee: parseEther("0.20") }],
    ]);

    it("returns 0 for empty citations", () => {
      expect(quote([], works, "0xDave")).toBe(0n);
    });

    it("sums fees when citing other authors", () => {
      const total = quote([1n, 2n], works, "0xDave000000000000000000000000000000000004");
      expect(total).toBe(parseEther("0.15"));
    });

    it("excludes fees for self-citations", () => {
      // Alice cites work 1 (her own) and work 2 (Bob)
      const total = quote(
        [1n, 2n],
        works,
        "0xAlice000000000000000000000000000000000001"
      );
      expect(total).toBe(parseEther("0.10"));
    });

    it("returns 0 when citing exclusively own works", () => {
      const total = quote(
        [1n],
        works,
        "0xalice000000000000000000000000000000000001" // case-insensitive
      );
      expect(total).toBe(0n);
    });
  });

  describe("refLabel", () => {
    it("formats reference brackets", () => {
      expect(refLabel(1)).toBe("[1]");
      expect(refLabel(42n)).toBe("[42]");
    });
  });

  describe("formatFee", () => {
    it("formats 0 wei as Free", () => {
      expect(formatFee(0n)).toBe("Free");
    });

    it("formats ether amounts cleanly", () => {
      expect(formatFee(parseEther("0.05"))).toBe("0.05 BOT");
      expect(formatFee(parseEther("1"))).toBe("1 BOT");
    });
  });

  describe("truncateHash", () => {
    it("truncates 32-byte hashes cleanly", () => {
      const h = "0x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
      expect(truncateHash(h)).toBe("0x2cf2…9824");
    });
  });

  describe("foldCitedBy", () => {
    it("folds published event logs into incoming citations index", () => {
      const logs: PublishedEvent[] = [
        {
          id: 2n,
          author: "0xBob" as `0x${string}`,
          contentHash: "0x1111" as `0x${string}`,
          title: "Paper 2",
          fee: 0n,
          cites: [1n],
        },
        {
          id: 3n,
          author: "0xCharlie" as `0x${string}`,
          contentHash: "0x2222" as `0x${string}`,
          title: "Paper 3",
          fee: 0n,
          cites: [1n, 2n],
        },
      ];

      const folded = foldCitedBy(logs);
      expect(folded.get(1n)?.length).toBe(2);
      expect(folded.get(2n)?.length).toBe(1);
      expect(folded.get(3n)).toBeUndefined();
    });
  });

  describe("describeError", () => {
    it("decodes WrongPayment with formatted fee", () => {
      const err = new Error("reverted with custom error 'WrongPayment(50000000000000000)'");
      expect(describeError(err)).toBe("Citing these works costs 0.05 BOT.");
    });

    it("decodes AlreadyPublished with existing ID", () => {
      const err = new Error("reverted with custom error 'AlreadyPublished(7)'");
      expect(describeError(err)).toBe("This file is already published as [7].");
    });

    it("decodes BadCitation with citation ID", () => {
      const err = new Error("reverted with custom error 'BadCitation(99)'");
      expect(describeError(err)).toBe("Work [99] can't be cited here.");
    });

    it("decodes zero-arg custom errors", () => {
      expect(describeError(new Error("ZeroHash()"))).toBe("Content hash cannot be empty.");
      expect(describeError(new Error("EmptyTitle()"))).toBe("Title cannot be empty.");
      expect(describeError(new Error("TitleTooLong()"))).toBe("Title cannot exceed 64 bytes.");
      expect(describeError(new Error("FeeTooHigh()"))).toBe("Fee cannot exceed 1 BOT.");
      expect(describeError(new Error("TooManyCitations()"))).toBe("Cannot cite more than 8 works.");
      expect(describeError(new Error("NothingToWithdraw()"))).toBe("No pending balance to withdraw.");
      expect(describeError(new Error("ReentrantCall()"))).toBe("Reentrant call rejected.");
    });

    it("decodes wallet rejection errors", () => {
      expect(describeError(new Error("User rejected the request"))).toBe(
        "Transaction was rejected in wallet."
      );
    });
  });

  describe("protocol limits", () => {
    it("defines protocol boundary constants", () => {
      expect(MAX_CITES).toBe(8);
      expect(MAX_TITLE).toBe(64);
      expect(MAX_BATCH_VIEW).toBe(50);
      expect(MAX_FEE).toBe(1000000000000000000n);
    });
  });
});
