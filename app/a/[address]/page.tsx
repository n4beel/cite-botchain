"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { isAddress, type Address } from "viem";
import { notFound } from "next/navigation";
import { useReadContract, useReadContracts } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import { citeAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { activeBotChain } from "@/lib/botchain/chain";
import { formatFee, refLabel, truncateHash, type WorkData } from "@/lib/cite";

interface AuthorPageProps {
  params: Promise<{ address: string }>;
}

export default function AuthorPage({ params }: AuthorPageProps) {
  const { address: rawAddress } = use(params);

  if (!isAddress(rawAddress)) {
    notFound();
  }

  const authorAddress = rawAddress as Address;
  const deployment = getDeployment(activeBotChain.id);
  const deployed = isDeployed(activeBotChain.id);

  // 1. Read author work IDs
  const { data: workIdsRaw, isLoading: isIdsLoading } = useReadContract({
    address: deployment.address,
    abi: citeAbi,
    functionName: "byAuthor",
    args: [authorAddress],
    query: { enabled: deployed },
  });

  const workIds = workIdsRaw ? [...workIdsRaw] : [];

  // 2. Read details of all author works
  const { data: worksRaw, isLoading: isWorksLoading } = useReadContracts({
    contracts: workIds.map((id) => ({
      address: deployment.address,
      abi: citeAbi,
      functionName: "workOf",
      args: [id],
    })),
    query: { enabled: workIds.length > 0 },
  });

  const authorWorks: WorkData[] = useMemo(() => {
    if (!worksRaw) return [];
    return worksRaw
      .map((res, idx) => {
        const w = res.result as any;
        if (!w) return null;
        return {
          id: workIds[idx],
          author: w.author,
          fee: w.fee,
          at: w.at,
          citedBy: Number(w.citedBy),
          citeCount: Number(w.citeCount),
          contentHash: w.contentHash,
          title: w.title,
        };
      })
      .filter((w): w is WorkData => w !== null);
  }, [worksRaw, workIds]);

  const totalCitations = authorWorks.reduce((acc, w) => acc + w.citedBy, 0);

  return (
    <PageShell>
      <div className="max-w-[760px] mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between text-[13px] text-[#5B4A78]">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[#B5179E] hover:underline font-medium"
          >
            &larr; Back to Bibliography
          </Link>
          <span className="font-mono">{truncateHash(authorAddress, 6, 4)}</span>
        </div>

        {/* Author Profile Header */}
        <Panel variant="scholarly" className="p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#5B4A78] block mb-1">
                Scholar Profile
              </span>
              <h2 className="font-mono text-[18px] sm:text-[22px] font-bold text-[#1E1233] break-all">
                {authorAddress}
              </h2>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[#ECE3FA] grid grid-cols-2 gap-4">
            <div className="p-3 bg-[#FAF7FF] rounded-[4px] border border-[#D9CCF0]">
              <span className="block text-[11px] text-[#5B4A78] uppercase tracking-wider font-semibold">
                Works Published
              </span>
              <span className="font-mono text-[24px] font-bold text-[#1E1233]">
                {workIds.length}
              </span>
            </div>

            <div className="p-3 bg-[#FAF7FF] rounded-[4px] border border-[#D9CCF0]">
              <span className="block text-[11px] text-[#5B4A78] uppercase tracking-wider font-semibold">
                Total Inbound Citations
              </span>
              <span className="font-mono text-[24px] font-bold text-[#B5179E]">
                {totalCitations}
              </span>
            </div>
          </div>
        </Panel>

        {/* Author's Published Works */}
        <div className="flex flex-col gap-4">
          <h3 className="font-serif font-bold text-[18px] text-[#1E1233]">
            Published Works ({authorWorks.length})
          </h3>

          {isIdsLoading || isWorksLoading ? (
            <div className="py-12 text-center text-[13px] text-[#5B4A78]">
              Loading author literature…
            </div>
          ) : authorWorks.length === 0 ? (
            <Panel variant="scholarly" className="text-center py-10 text-[13px] text-[#5B4A78]">
              This author has not published any works yet.
            </Panel>
          ) : (
            <div className="flex flex-col gap-3">
              {authorWorks.map((w) => (
                <Link
                  key={w.id.toString()}
                  href={`/w/${w.id.toString()}`}
                  className="p-4 rounded-[4px] bg-white border border-[#D9CCF0] hover:border-[#B5179E] hover:bg-[#FAF7FF] transition-all no-underline flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] font-bold text-[#B5179E] bg-[#F3EAFF] px-2 py-0.5 rounded-[2px] border border-[#D9CCF0]">
                      {refLabel(w.id)}
                    </span>
                    <span className="font-serif font-bold text-[15px] text-[#1E1233]">
                      {w.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[12px] font-mono text-[#5B4A78]">
                    <span>Fee: {formatFee(w.fee)}</span>
                    <span className="text-[#B5179E] font-semibold">
                      cited by {w.citedBy}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
