"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useReadContract, useChainId, usePublicClient } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import CitationTree from "@/components/cite/CitationTree";
import Panel from "@/components/ui/Panel";
import { citeAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { type BotChainId, isBotChainId } from "@/lib/botchain/chain";
import { foldCitedBy, refLabel, type WorkData } from "@/lib/cite";
import { parsePublishedLog, type PublishedEvent } from "@/lib/logs";

interface WorkPageProps {
  params: Promise<{ id: string }>;
}

export default function WorkPage({ params }: WorkPageProps) {
  const { id: rawId } = use(params);
  const workId = Number(rawId);

  const chainId = useChainId();
  const currentChainId: BotChainId = isBotChainId(chainId) ? chainId : 968;
  const deployment = getDeployment(currentChainId);
  const deployed = isDeployed(currentChainId);
  const publicClient = usePublicClient();

  const [publishedLogs, setPublishedLogs] = useState<PublishedEvent[]>([]);
  const [isScanningLogs, setIsScanningLogs] = useState(false);

  if (isNaN(workId) || workId <= 0) {
    notFound();
  }

  // 1. Read work metadata
  const {
    data: workRaw,
    isLoading: isWorkLoading,
    isError,
  } = useReadContract({
    address: deployment.address,
    abi: citeAbi,
    functionName: "workOf",
    args: [BigInt(workId)],
    query: { enabled: deployed },
  });

  // 2. Scan Published logs for incoming citations
  useEffect(() => {
    const client = publicClient;
    if (!client || !deployed || !deployment.address) return;

    let cancelled = false;
    async function fetchLogs() {
      if (!client) return;
      setIsScanningLogs(true);
      try {
        const fromBlock = deployment.deployBlock ? BigInt(deployment.deployBlock) : 0n;
        const logs = await client.getLogs({
          address: deployment.address,
          event: {
            type: "event",
            name: "Published",
            inputs: [
              { name: "id", type: "uint256", indexed: true },
              { name: "author", type: "address", indexed: true },
              { name: "contentHash", type: "bytes32", indexed: true },
              { name: "title", type: "string", indexed: false },
              { name: "fee", type: "uint128", indexed: false },
              { name: "cites", type: "uint256[]", indexed: false },
            ],
          },
          fromBlock,
          toBlock: "latest",
        });

        if (!cancelled) {
          const parsed = logs
            .map((l) => parsePublishedLog(l))
            .filter((p): p is PublishedEvent => p !== null);
          setPublishedLogs(parsed);
        }
      } catch {
        // Log scan failure handled gracefully
      } finally {
        if (!cancelled) setIsScanningLogs(false);
      }
    }

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [publicClient, deployed, deployment.address, deployment.deployBlock]);

  const incomingMap = useMemo(() => foldCitedBy(publishedLogs), [publishedLogs]);

  if (isError) {
    notFound();
  }

  const work: WorkData | null = workRaw
    ? {
        id: BigInt(workId),
        author: workRaw.author,
        fee: workRaw.fee,
        at: workRaw.at,
        citedBy: Number(workRaw.citedBy),
        citeCount: Number(workRaw.citeCount),
        contentHash: workRaw.contentHash,
        title: workRaw.title,
      }
    : null;

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
          <span className="font-mono">{refLabel(workId)}</span>
        </div>

        {isWorkLoading || !work ? (
          <div className="py-20 text-center text-[14px] text-[#5B4A78] font-serif">
            Loading work details…
          </div>
        ) : (
          <CitationTree
            work={work}
            deploymentAddress={deployment.address}
            incomingCitations={incomingMap.get(work.id) ?? []}
            isScanningLogs={isScanningLogs}
          />
        )}
      </div>
    </PageShell>
  );
}
