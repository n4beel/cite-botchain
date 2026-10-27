import { formatEther } from "viem";

/**
 * Human-readable explanations for Cite contract errors and transaction issues.
 */
export function describeError(err: unknown): string {
  if (!err) return "An unknown error occurred.";

  const str = String(err);
  const msg = err instanceof Error ? err.message : str;

  // Custom Contract Errors with Arguments
  if (msg.includes("WrongPayment") || str.includes("WrongPayment")) {
    const match = (msg + " " + str).match(/WrongPayment\((\d+)\)/);
    if (match?.[1]) {
      try {
        const requiredBot = formatEther(BigInt(match[1]));
        return `Citing these works costs ${requiredBot} BOT.`;
      } catch {
        return "Incorrect citation fee provided.";
      }
    }
    return "Incorrect citation fee provided.";
  }

  if (msg.includes("AlreadyPublished") || str.includes("AlreadyPublished")) {
    const match = (msg + " " + str).match(/AlreadyPublished\((\d+)\)/);
    if (match?.[1]) {
      return `This file is already published as [${match[1]}].`;
    }
    return "This file is already published.";
  }

  if (msg.includes("BadCitation") || str.includes("BadCitation")) {
    const match = (msg + " " + str).match(/BadCitation\((\d+)\)/);
    if (match?.[1]) {
      return `Work [${match[1]}] can't be cited here.`;
    }
    return "Invalid citation specified.";
  }

  // Zero-arg Custom Errors
  if (msg.includes("ZeroHash") || str.includes("ZeroHash")) {
    return "Content hash cannot be empty.";
  }

  if (msg.includes("EmptyTitle") || str.includes("EmptyTitle")) {
    return "Title cannot be empty.";
  }

  if (msg.includes("TitleTooLong") || str.includes("TitleTooLong")) {
    return "Title cannot exceed 64 bytes.";
  }

  if (msg.includes("FeeTooHigh") || str.includes("FeeTooHigh")) {
    return "Fee cannot exceed 1 BOT.";
  }

  if (msg.includes("TooManyCitations") || str.includes("TooManyCitations")) {
    return "Cannot cite more than 8 works.";
  }

  if (msg.includes("NoSuchWork") || str.includes("NoSuchWork")) {
    return "Referenced work does not exist.";
  }

  if (msg.includes("NothingToWithdraw") || str.includes("NothingToWithdraw")) {
    return "No pending balance to withdraw.";
  }

  if (msg.includes("TransferFailed") || str.includes("TransferFailed")) {
    return "BOT withdrawal transfer failed.";
  }

  if (msg.includes("ReentrantCall") || str.includes("ReentrantCall")) {
    return "Reentrant call rejected.";
  }

  if (msg.includes("DirectDepositNotAllowed") || str.includes("DirectDepositNotAllowed")) {
    return "Direct BOT deposits are not accepted.";
  }

  // Common Web3 / RPC Errors
  if (
    msg.includes("User rejected") ||
    msg.includes("user rejected") ||
    msg.includes("ACTION_REJECTED")
  ) {
    return "Transaction was rejected in wallet.";
  }

  if (msg.includes("insufficient funds") || msg.includes("exceeds balance")) {
    return "Insufficient funds in wallet for gas and citation fees.";
  }

  return msg.length > 140 ? `${msg.slice(0, 137)}...` : msg;
}
