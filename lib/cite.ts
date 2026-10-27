/**
 * Cite domain logic and helper utilities.
 */
import { formatEther } from "viem";
import type { PublishedEvent } from "./logs";

export interface WorkData {
  id: bigint;
  author: `0x${string}`;
  fee: bigint;
  at: bigint;
  citedBy: number;
  citeCount: number;
  contentHash: `0x${string}`;
  title: string;
}

/**
 * Computes SHA-256 hash of a file or ArrayBuffer in the browser using Web Crypto API.
 * The file is never uploaded anywhere; hashing is entirely local.
 */
export async function sha256Buffer(buffer: ArrayBuffer): Promise<`0x${string}`> {
  // Use global crypto (works in modern browsers and Node 18+)
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hashHex}`;
}

export async function sha256File(file: File): Promise<`0x${string}`> {
  const buffer = await file.arrayBuffer();
  return sha256Buffer(buffer);
}

/**
 * Computes total required citation payment, mirroring contract quote logic:
 * sum of fees of cited works whose author != publisher.
 * Self-citations cost 0.
 */
export function quote(
  cites: readonly bigint[] | bigint[],
  works: Map<bigint, { author: string; fee: bigint }>,
  author?: string
): bigint {
  let owed = 0n;
  const authorLower = author ? author.toLowerCase() : "";

  for (const cId of cites) {
    const cited = works.get(cId);
    if (!cited) continue;

    if (!authorLower || cited.author.toLowerCase() !== authorLower) {
      owed += cited.fee;
    }
  }

  return owed;
}

/**
 * Formats a work reference number (e.g. "[14]").
 */
export function refLabel(id: bigint | number): string {
  return `[${id.toString()}]`;
}

/**
 * Formats a fee in BOT (or "Free" if 0).
 */
export function formatFee(fee: bigint): string {
  if (fee === 0n) return "Free";
  const str = formatEther(fee);
  // Trim trailing decimal zeroes if clean
  const clean = str.includes(".") ? str.replace(/\.?0+$/, "") : str;
  return `${clean} BOT`;
}

/**
 * Truncates an address or 32-byte content hash for scholarly display.
 */
export function truncateHash(hash: string, lead = 6, tail = 4): string {
  if (!hash || hash.length <= lead + tail) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}

/**
 * Folds Published event logs into a lookup map of workId -> array of works citing it.
 */
export function foldCitedBy(logs: PublishedEvent[]): Map<bigint, PublishedEvent[]> {
  const map = new Map<bigint, PublishedEvent[]>();

  for (const log of logs) {
    for (const citedId of log.cites) {
      const existing = map.get(citedId) ?? [];
      existing.push(log);
      map.set(citedId, existing);
    }
  }

  return map;
}
