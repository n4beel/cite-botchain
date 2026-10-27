"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseEther, formatEther, type Address } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import { useToast } from "@/components/ui/Toast";
import { citeAbi } from "@/lib/botchain/abi";
import { describeError } from "@/lib/errors";
import { parsePublishedLog } from "@/lib/logs";
import {
  formatFee,
  quote,
  refLabel,
  sha256Buffer,
  truncateHash,
  type WorkData,
} from "@/lib/cite";
import { MAX_CITES, MAX_FEE, MAX_TITLE } from "@/lib/limits";

interface PublishFormProps {
  allWorks: WorkData[];
  deploymentAddress: Address;
  initialCiteId?: bigint;
}

export default function PublishForm({
  allWorks,
  deploymentAddress,
  initialCiteId,
}: PublishFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const { data: balanceData } = useBalance({ address });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [contentHash, setContentHash] = useState<`0x${string}` | "">("");
  const [isHashing, setIsHashing] = useState(false);
  const [title, setTitle] = useState("");
  const [feeBot, setFeeBot] = useState("0.05");
  const [selectedCites, setSelectedCites] = useState<bigint[]>(() =>
    initialCiteId && initialCiteId > 0n ? [initialCiteId] : []
  );

  // Check if hash is already published on-chain
  const { data: existingIdRaw } = useReadContract({
    address: deploymentAddress,
    abi: citeAbi,
    functionName: "idOfHash",
    args: contentHash ? [contentHash] : undefined,
    query: { enabled: Boolean(contentHash) },
  });

  const existingId = existingIdRaw && existingIdRaw > 0n ? existingIdRaw : null;

  // Title byte length check
  const titleBytes = new TextEncoder().encode(title).length;
  const isTitleValid = titleBytes > 0 && titleBytes <= MAX_TITLE;

  // Parse fee
  let parsedFee = 0n;
  let isFeeValid = false;
  try {
    if (feeBot.trim() !== "") {
      parsedFee = parseEther(feeBot);
      if (parsedFee >= 0n && parsedFee <= MAX_FEE) {
        isFeeValid = true;
      }
    }
  } catch {
    isFeeValid = false;
  }

  // Work lookup map for off-chain quote preview
  const worksMap = useMemo(() => {
    const map = new Map<bigint, { author: string; fee: bigint }>();
    for (const w of allWorks) {
      map.set(w.id, { author: w.author, fee: w.fee });
    }
    return map;
  }, [allWorks]);

  // Off-chain calculated quote
  const calculatedQuote = useMemo(() => {
    return quote(selectedCites, worksMap, address);
  }, [selectedCites, worksMap, address]);

  // On-chain quote verification
  const { data: onChainQuoteRaw } = useReadContract({
    address: deploymentAddress,
    abi: citeAbi,
    functionName: "quote",
    args: [selectedCites, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(address) && selectedCites.length > 0 },
  });

  const finalQuote = onChainQuoteRaw !== undefined ? onChainQuoteRaw : calculatedQuote;

  // Balance sufficiency check
  const userBalance = balanceData?.value ?? 0n;
  const hasSufficientBalance = userBalance >= finalQuote;

  // Contract write
  const {
    writeContract: writePublish,
    data: publishTxHash,
    isPending: isPublishPending,
    error: publishError,
  } = useWriteContract();

  const {
    isLoading: isPublishWaiting,
    isSuccess: isPublishSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: publishTxHash });

  // Handle file selection and client-side hashing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsHashing(true);

    try {
      const buffer = await file.arrayBuffer();
      const hash = await sha256Buffer(buffer);
      setContentHash(hash);
      if (!title) {
        // Default title to filename without extension
        const base = file.name.replace(/\.[^/.]+$/, "");
        setTitle(base.slice(0, 60));
      }
    } catch (err) {
      toast("error", "Failed to compute SHA-256 locally.");
    } finally {
      setIsHashing(false);
    }
  };

  const toggleCite = (cId: bigint) => {
    if (selectedCites.includes(cId)) {
      setSelectedCites(selectedCites.filter((id) => id !== cId));
    } else {
      if (selectedCites.length >= MAX_CITES) {
        toast("error", `Cannot cite more than ${MAX_CITES} works.`);
        return;
      }
      setSelectedCites([...selectedCites, cId]);
    }
  };

  const handlePublish = () => {
    if (!isConnected) {
      toast("error", "Connect wallet to publish.");
      return;
    }
    if (!contentHash) {
      toast("error", "Select a file to anchor its hash.");
      return;
    }
    if (existingId) {
      toast("error", `This content is already published as [${existingId.toString()}].`);
      return;
    }
    if (!isTitleValid) {
      toast("error", "Title must be between 1 and 64 bytes.");
      return;
    }
    if (!isFeeValid) {
      toast("error", "Fee must be between 0 and 1 BOT.");
      return;
    }

    try {
      writePublish({
        address: deploymentAddress,
        abi: citeAbi,
        functionName: "publish",
        args: [contentHash, title, selectedCites, parsedFee],
        value: finalQuote,
      });
      toast("info", "Publication submitted to wallet.");
    } catch (err) {
      toast("error", describeError(err));
    }
  };

  // Redirect to newly published work upon transaction receipt
  useEffect(() => {
    if (isPublishSuccess && receipt) {
      for (const log of receipt.logs) {
        const parsed = parsePublishedLog(log);
        if (parsed) {
          toast("success", `Work [${parsed.id.toString()}] published!`);
          router.push(`/w/${parsed.id.toString()}`);
          return;
        }
      }
      toast("success", "Publication confirmed on-chain!");
      router.push("/");
    }
  }, [isPublishSuccess, receipt, router, toast]);

  return (
    <div className="max-w-[760px] mx-auto flex flex-col gap-8">
      <Panel variant="scholarly" className="p-6 md:p-8">
        <h2 className="font-serif text-[22px] font-bold text-[#1E1233] mb-2">
          Publish Work &amp; Anchor Citations
        </h2>
        <p className="text-[13px] text-[#5B4A78] leading-relaxed mb-6 pb-4 border-b border-[#ECE3FA]">
          Compute the cryptographic SHA-256 hash of your document entirely in your browser. The file is never uploaded.
        </p>

        <div className="flex flex-col gap-6">
          {/* 1. File Picker */}
          <div>
            <label className="block text-[12px] font-semibold text-[#1E1233] uppercase tracking-wider mb-2">
              1. Document File (SHA-256)
            </label>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="scholarly"
                size="md"
                onClick={() => fileInputRef.current?.click()}
                disabled={isHashing}
              >
                {fileName ? "Change Document" : "Choose Local File"}
              </Button>

              <div className="flex-1 px-3 py-2 bg-[#FAF7FF] rounded-[4px] border border-[#D9CCF0] text-[12px] font-mono text-[#5B4A78] truncate">
                {isHashing ? (
                  <span className="text-[#B5179E]">Computing local SHA-256…</span>
                ) : contentHash ? (
                  <span className="text-[#1E1233]">{contentHash}</span>
                ) : (
                  <span>No file chosen (or enter manually below)</span>
                )}
              </div>
            </div>

            {/* Manual Hash Fallback */}
            {!fileName && (
              <div className="mt-2">
                <input
                  type="text"
                  value={contentHash}
                  onChange={(e) => setContentHash(e.target.value.trim() as `0x${string}`)}
                  placeholder="Or paste 32-byte 0x... hash directly"
                  className="w-full px-3 py-1.5 rounded-[4px] border border-[#D9CCF0] bg-white text-[12px] font-mono text-[#1E1233] placeholder-[#8472A3] focus:outline-none focus:border-[#B5179E]"
                />
              </div>
            )}

            {existingId && (
              <div className="mt-2.5 p-3 rounded-[4px] bg-[#FEF7E0] border border-[#F5C6CB] text-[12px] text-[#8A5A00]">
                ⚠️ This exact content hash is already registered as{" "}
                <Link
                  href={`/w/${existingId.toString()}`}
                  className="font-bold underline text-[#B5179E]"
                >
                  Work [{existingId.toString()}]
                </Link>
                . First to publish holds the hash anchor.
              </div>
            )}
          </div>

          {/* 2. Title */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold text-[#1E1233] uppercase tracking-wider">
                2. Work Title
              </label>
              <span
                className={`text-[11px] font-mono ${
                  titleBytes > MAX_TITLE ? "text-[#B3261E] font-bold" : "text-[#8472A3]"
                }`}
              >
                {titleBytes} / {MAX_TITLE} bytes
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Foundational Graph Theory for Decentralized Ledgers"
              className="w-full px-3.5 py-2.5 rounded-[4px] border border-[#D9CCF0] bg-white font-serif text-[15px] text-[#1E1233] placeholder-[#8472A3] focus:outline-none focus:border-[#B5179E]"
            />
          </div>

          {/* 3. Citation Fee */}
          <div>
            <label className="block text-[12px] font-semibold text-[#1E1233] uppercase tracking-wider mb-2">
              3. Citation Fee (BOT)
            </label>
            <p className="text-[12px] text-[#5B4A78] mb-2">
              What future authors must pay to cite this work. Fixed at publication (max 1.0 BOT).
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={feeBot}
                onChange={(e) => setFeeBot(e.target.value)}
                placeholder="0.05"
                className="w-[140px] px-3.5 py-2 rounded-[4px] border border-[#D9CCF0] bg-white font-mono text-[14px] text-[#1E1233] focus:outline-none focus:border-[#B5179E]"
              />
              <span className="font-mono text-[13px] text-[#5B4A78]">BOT</span>
            </div>
          </div>

          {/* 4. Citations Selection */}
          <div className="pt-2 border-t border-[#ECE3FA]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold text-[#1E1233] uppercase tracking-wider">
                4. Select Works to Cite ({selectedCites.length} / {MAX_CITES})
              </label>
              <span className="text-[12px] text-[#5B4A78]">
                Authors will be paid their fee immediately.
              </span>
            </div>

            {allWorks.length === 0 ? (
              <div className="p-3 bg-[#FAF7FF] rounded-[4px] text-[13px] text-[#5B4A78] italic">
                No earlier works exist to cite. This will be a foundational work.
              </div>
            ) : (
              <div className="max-h-[220px] overflow-y-auto p-2 bg-[#FAF7FF] rounded-[4px] border border-[#D9CCF0] flex flex-col gap-1.5">
                {allWorks.map((w) => {
                  const isCited = selectedCites.includes(w.id);
                  const isOwn =
                    address && w.author.toLowerCase() === address.toLowerCase();

                  return (
                    <div
                      key={w.id.toString()}
                      data-cite-id={w.id.toString()}
                      onClick={() => toggleCite(w.id)}
                      className={`p-2.5 rounded-[4px] border transition-all cursor-pointer flex items-center justify-between text-[12px] ${
                        isCited
                          ? "bg-[#F3EAFF] border-[#B5179E]"
                          : "bg-white border-[#ECE3FA] hover:border-[#D9CCF0]"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="font-mono text-[11px] font-bold text-[#B5179E]">
                          {refLabel(w.id)}
                        </span>
                        <span className="font-serif font-medium text-[#1E1233] truncate">
                          {w.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px] flex-shrink-0">
                        {isOwn ? (
                          <span className="text-[#1F7A3D] font-bold">Self (Free)</span>
                        ) : (
                          <span className="text-[#1E1233]">{formatFee(w.fee)}</span>
                        )}
                        <input
                          type="checkbox"
                          checked={isCited}
                          onChange={() => {}} // handled by parent div
                          className="accent-[#B5179E]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Citation Footnote Chips */}
          {selectedCites.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[11px] uppercase tracking-wider text-[#5B4A78] font-semibold">
                Footnotes:
              </span>
              {selectedCites.map((cId) => {
                const w = allWorks.find((work) => work.id === cId);
                return (
                  <span
                    key={cId.toString()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-[#FAF7FF] border border-[#D9CCF0] text-[11px] font-mono text-[#1E1233]"
                  >
                    <span className="font-bold text-[#B5179E]">{refLabel(cId)}</span>
                    <span className="truncate max-w-[120px] font-serif">{w?.title ?? "Work"}</span>
                    <button
                      type="button"
                      onClick={() => toggleCite(cId)}
                      className="text-[#8472A3] hover:text-[#B3261E] ml-1 font-bold"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* 5. Live Cost & Publish Action */}
          <div className="pt-4 border-t border-[#D9CCF0] flex flex-col gap-4">
            <div className="flex items-center justify-between text-[14px]">
              <span className="font-medium text-[#1E1233]">Cost to Publish:</span>
              <div className="text-right">
                <span className="font-mono text-[18px] font-bold text-[#B5179E]">
                  {formatEther(finalQuote)} BOT
                </span>
                {finalQuote === 0n && (
                  <span className="block text-[11px] text-[#1F7A3D]">
                    Free (only gas required)
                  </span>
                )}
              </div>
            </div>

            {publishError && (
              <div className="p-3.5 bg-[#FCE8E6] text-[#B3261E] border border-[#F5C6CB] rounded-[4px] text-[13px]">
                {describeError(publishError)}
              </div>
            )}

            {!hasSufficientBalance && isConnected && (
              <div className="p-3 bg-[#FEF7E0] text-[#8A5A00] border border-[#F5C6CB] rounded-[4px] text-[12px]">
                Insufficient wallet balance ({formatEther(userBalance)} BOT) to pay citation royalties ({formatEther(finalQuote)} BOT).
              </div>
            )}

            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={
                !isConnected ||
                !contentHash ||
                Boolean(existingId) ||
                !isTitleValid ||
                !isFeeValid ||
                !hasSufficientBalance
              }
              loading={isPublishPending || isPublishWaiting}
              onClick={handlePublish}
              className="w-full"
            >
              {!isConnected
                ? "Connect Wallet to Publish"
                : isPublishWaiting
                ? "Confirming On-Chain..."
                : isPublishPending
                ? "Submitting to Wallet..."
                : finalQuote > 0n
                ? `Publish & Pay ${formatEther(finalQuote)} BOT`
                : "Publish and cite (Free)"}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
