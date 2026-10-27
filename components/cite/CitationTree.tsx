"use client";

import Link from "next/link";
import { formatEther, type Address } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import { citeAbi } from "@/lib/botchain/abi";
import { formatFee, refLabel, truncateHash, type WorkData } from "@/lib/cite";
import type { PublishedEvent } from "@/lib/logs";

interface CitationTreeProps {
  work: WorkData;
  deploymentAddress: Address;
  incomingCitations?: PublishedEvent[];
  isScanningLogs?: boolean;
}

export default function CitationTree({
  work,
  deploymentAddress,
  incomingCitations = [],
  isScanningLogs = false,
}: CitationTreeProps) {
  // Read works cited by this work
  const { data: citedIdsRaw, isLoading: isCitesLoading } = useReadContract({
    address: deploymentAddress,
    abi: citeAbi,
    functionName: "citesOf",
    args: [work.id],
  });

  const citedIds = citedIdsRaw ? [...citedIdsRaw] : [];

  // Batch read details of cited works
  const { data: citedWorksRaw } = useReadContracts({
    contracts: citedIds.map((cId) => ({
      address: deploymentAddress,
      abi: citeAbi,
      functionName: "workOf",
      args: [cId],
    })),
    query: { enabled: citedIds.length > 0 },
  });

  const formattedDate = work.at > 0n
    ? new Date(Number(work.at) * 1000).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <div className="flex flex-col gap-6">
      {/* Selected Work Header Details */}
      <Panel variant="scholarly" className="p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[12px] font-bold text-[#B5179E] bg-[#F3EAFF] px-2 py-0.5 rounded-[3px] border border-[#D9CCF0]">
                {refLabel(work.id)}
              </span>
              <span className="text-[12px] font-mono text-[#5B4A78]">
                {formattedDate}
              </span>
            </div>

            <h2 className="font-serif text-[22px] md:text-[26px] font-bold leading-tight text-[#1E1233] mb-3">
              {work.title}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[#5B4A78]">
              <div>
                Author:{" "}
                <Link
                  href={`/a/${work.author}`}
                  className="font-mono text-[#B5179E] hover:underline"
                >
                  {truncateHash(work.author, 8, 6)}
                </Link>
              </div>
              <span className="text-[#D9CCF0]">·</span>
              <div>
                Fee to Cite:{" "}
                <span className="font-mono font-semibold text-[#1E1233]">
                  {formatFee(work.fee)}
                </span>
              </div>
              <span className="text-[#D9CCF0]">·</span>
              <div>
                Cited by:{" "}
                <span className="font-mono font-bold text-[#B5179E]">
                  {work.citedBy}
                </span>{" "}
                {work.citedBy === 1 ? "work" : "works"}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#ECE3FA] flex items-center justify-between text-[11px] text-[#8472A3]">
              <div className="flex items-center gap-2">
                <span>SHA-256:</span>
                <code className="font-mono bg-[#FAF7FF] px-1.5 py-0.5 rounded-[2px] border border-[#ECE3FA] text-[#1E1233]">
                  {work.contentHash}
                </code>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Link href={`/publish?cite=${work.id.toString()}`}>
            <Button variant="primary" size="sm" citationNumber={work.id}>
              Cite this Work
            </Button>
          </Link>
          <Link href={`/w/${work.id.toString()}`}>
            <Button variant="scholarly" size="sm">
              Permalink
            </Button>
          </Link>
        </div>
      </Panel>

      {/* Upstream Citation Tree: What this work cites */}
      <Panel variant="scholarly" className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#ECE3FA]">
          <div className="flex items-center gap-2">
            <span className="text-[#B5179E] text-[14px]">↑</span>
            <h3 className="font-serif font-bold text-[16px] text-[#1E1233]">
              Cites ({citedIds.length})
            </h3>
          </div>
          <span className="text-[12px] text-[#5B4A78]">Works built upon</span>
        </div>

        {isCitesLoading ? (
          <div className="py-4 text-[13px] text-[#5B4A78]">Loading citations…</div>
        ) : citedIds.length === 0 ? (
          <div className="py-3 px-3 bg-[#FAF7FF] rounded-[4px] border border-[#ECE3FA] text-[13px] text-[#5B4A78] italic">
            This work is foundational (cites 0 earlier works).
          </div>
        ) : (
          <div className="tree-stem flex flex-col gap-3">
            {citedIds.map((cId, idx) => {
              const res = citedWorksRaw?.[idx]?.result as any;
              const title = res?.title ?? `Work #${cId}`;
              const author = res?.author as Address | undefined;
              const fee = res?.fee ? (res.fee as bigint) : 0n;

              return (
                <div key={cId.toString()} className="tree-branch flex items-center justify-between gap-3 text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#B5179E]">
                      {refLabel(cId)}
                    </span>
                    <Link
                      href={`/w/${cId.toString()}`}
                      className="font-serif font-medium text-[#1E1233] hover:text-[#B5179E] hover:underline"
                    >
                      {title}
                    </Link>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-[#5B4A78] font-mono">
                    {author && <span>by {truncateHash(author, 6, 4)}</span>}
                    <span className="text-[#1E1233] font-semibold">{formatFee(fee)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Downstream Citation Tree: Who cites this work */}
      <Panel variant="scholarly" className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#ECE3FA]">
          <div className="flex items-center gap-2">
            <span className="text-[#B5179E] text-[14px]">↓</span>
            <h3 className="font-serif font-bold text-[16px] text-[#1E1233]">
              Cited by ({work.citedBy})
            </h3>
          </div>
          <span className="text-[12px] text-[#5B4A78]">Subsequent literature</span>
        </div>

        {isScanningLogs ? (
          <div className="py-4 text-[13px] text-[#5B4A78]">Scanning citation index…</div>
        ) : work.citedBy === 0 ? (
          <div className="py-3 px-3 bg-[#FAF7FF] rounded-[4px] border border-[#ECE3FA] text-[13px] text-[#5B4A78] italic">
            No works have cited this paper yet. Be the first to cite it!
          </div>
        ) : incomingCitations.length === 0 ? (
          <div className="py-3 px-3 bg-[#FAF7FF] rounded-[4px] border border-[#ECE3FA] text-[13px] text-[#5B4A78]">
            Recorded on-chain as cited by {work.citedBy} {work.citedBy === 1 ? "work" : "works"}.
          </div>
        ) : (
          <div className="tree-stem flex flex-col gap-3">
            {incomingCitations.map((inWork) => (
              <div
                key={inWork.id.toString()}
                className="tree-branch flex items-center justify-between gap-3 text-[13px]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[#B5179E]">
                    {refLabel(inWork.id)}
                  </span>
                  <Link
                    href={`/w/${inWork.id.toString()}`}
                    className="font-serif font-medium text-[#1E1233] hover:text-[#B5179E] hover:underline"
                  >
                    {inWork.title}
                  </Link>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-[#5B4A78] font-mono">
                  <span>by {truncateHash(inWork.author, 6, 4)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
