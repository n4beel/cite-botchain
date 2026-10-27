import { decodeEventLog, type Log } from "viem";
import { citeAbi } from "@/lib/botchain/abi";

export interface PublishedEvent {
  id: bigint;
  author: `0x${string}`;
  contentHash: `0x${string}`;
  title: string;
  fee: bigint;
  cites: bigint[];
  transactionHash?: `0x${string}`;
  blockNumber?: bigint;
}

export interface WithdrawnEvent {
  author: `0x${string}`;
  amount: bigint;
  transactionHash?: `0x${string}`;
  blockNumber?: bigint;
}

/**
 * Parses Published event log.
 */
export function parsePublishedLog(log: Log): PublishedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: citeAbi,
      data: log.data,
      topics: log.topics,
      eventName: "Published",
    });

    return {
      id: decoded.args.id,
      author: decoded.args.author as `0x${string}`,
      contentHash: decoded.args.contentHash as `0x${string}`,
      title: decoded.args.title,
      fee: BigInt(decoded.args.fee),
      cites: decoded.args.cites.map((c) => BigInt(c)),
      transactionHash: log.transactionHash ?? undefined,
      blockNumber: log.blockNumber ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Parses Withdrawn event log.
 */
export function parseWithdrawnLog(log: Log): WithdrawnEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: citeAbi,
      data: log.data,
      topics: log.topics,
      eventName: "Withdrawn",
    });

    return {
      author: decoded.args.author as `0x${string}`,
      amount: decoded.args.amount,
      transactionHash: log.transactionHash ?? undefined,
      blockNumber: log.blockNumber ?? undefined,
    };
  } catch {
    return null;
  }
}
