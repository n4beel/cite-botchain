"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useReadContract, usePublicClient } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import BibliographyList from "@/components/cite/BibliographyList";
import CitationTree from "@/components/cite/CitationTree";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import { citeAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { activeBotChain } from "@/lib/botchain/chain";
import { foldCitedBy, type WorkData } from "@/lib/cite";
import { parsePublishedLog, type PublishedEvent } from "@/lib/logs";

export default function HomePage() {
  const deployment = getDeployment(activeBotChain.id);
  const deployed = isDeployed(activeBotChain.id);
  const publicClient = usePublicClient({ chainId: activeBotChain.id }); // stable-hook-result

  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [publishedLogs, setPublishedLogs] = useState<PublishedEvent[]>([]);
  const [isScanningLogs, setIsScanningLogs] = useState(false);

  // 1. Read total work count
  const { data: totalWorksRaw, isLoading: isCountLoading } = useReadContract({
    address: deployment.address,
    abi: citeAbi,
    functionName: "workCount",
    query: { enabled: deployed },
  });

  const totalWorks = totalWorksRaw !== undefined ? Number(totalWorksRaw) : undefined;

  // 2. Read latest 50 works
  const { data: latestRaw, isLoading: isLatestLoading } = useReadContract({
    address: deployment.address,
    abi: citeAbi,
    functionName: "latest",
    args: [0n, 50n],
    query: { enabled: deployed && Boolean(totalWorks && totalWorks > 0) },
  });

  const works: WorkData[] = useMemo(() => {
    if (!latestRaw || !latestRaw[0] || !latestRaw[1]) return [];
    const list = latestRaw[0];
    const ids = latestRaw[1];
    return list.map((w, idx) => ({
      id: ids[idx],
      author: w.author,
      fee: w.fee,
      at: w.at,
      citedBy: Number(w.citedBy),
      citeCount: Number(w.citeCount),
      contentHash: w.contentHash,
      title: w.title,
    }));
  }, [latestRaw]);

  // Set default selected work to newest work
  useEffect(() => {
    if (selectedId === null && works.length > 0) {
      setSelectedId(works[0].id);
    }
  }, [works, selectedId]);

  // 3. Scan Published event logs to construct incoming citations tree
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
        // Log scan failure handled gracefully without fake values
      } finally {
        if (!cancelled) setIsScanningLogs(false);
      }
    }

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [publicClient, deployed, deployment.address, deployment.deployBlock]);

  // Incoming citation lookup map
  const incomingMap = useMemo(() => foldCitedBy(publishedLogs), [publishedLogs]);

  const activeWork = useMemo(() => {
    if (selectedId === null) return null;
    return works.find((w) => w.id === selectedId) ?? null;
  }, [works, selectedId]);

  return (
    <PageShell>
      {!deployed ? (
        <Panel variant="scholarly" className="text-center py-12">
          <h2 className="font-serif text-[20px] font-bold text-[#1E1233] mb-2">
            Contract Not Deployed
          </h2>
          <p className="text-[13px] text-[#5B4A78]">
            Please connect to BotChain Bohr testnet (Chain ID 968) or start the local stack.
          </p>
        </Panel>
      ) : isCountLoading || isLatestLoading ? (
        <div className="py-16 text-center text-[14px] text-[#5B4A78] font-serif">
          Consulting on-chain bibliography…
        </div>
      ) : works.length === 0 ? (
        <Panel variant="scholarly" className="text-center py-16 max-w-[600px] mx-auto">
          <div className="w-10 h-10 rounded-full bg-[#F3EAFF] text-[#B5179E] flex items-center justify-center font-serif text-[18px] mx-auto mb-3 font-bold">
            ¶
          </div>
          <h2 className="font-serif text-[22px] font-bold text-[#1E1233] mb-2">
            Nothing has been published.
          </h2>
          <p className="text-[13px] text-[#5B4A78] leading-relaxed mb-6">
            The on-chain bibliography is empty. Be the foundational author by publishing the first hash-anchored work.
          </p>
          <Link href="/publish">
            <Button variant="primary" size="md">
              Publish and Cite
            </Button>
          </Link>
        </Panel>
      ) : (
        /* Two-Column Reading Layout: Left = Numbered Bibliography; Right = Citation Tree */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Numbered Bibliography (5 cols on desktop) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#ECE3FA]">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-[16px] text-[#1E1233]">
                  Bibliography
                </span>
                <span className="font-mono text-[11px] bg-[#FAF7FF] text-[#5B4A78] px-2 py-0.5 rounded-[2px] border border-[#D9CCF0]">
                  {works.length} {works.length === 1 ? "work" : "works"}
                </span>
              </div>

              <Link
                href="/publish"
                className="text-[12px] font-semibold text-[#B5179E] hover:underline"
              >
                + New Work
              </Link>
            </div>

            <BibliographyList
              works={works}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
            />
          </div>

          {/* Right Column: Citation Tree (7 cols on desktop) */}
          <div className="lg:col-span-7">
            {activeWork ? (
              <CitationTree
                work={activeWork}
                deploymentAddress={deployment.address}
                incomingCitations={incomingMap.get(activeWork.id) ?? []}
                isScanningLogs={isScanningLogs}
              />
            ) : (
              <Panel variant="scholarly" className="text-center py-12 text-[13px] text-[#5B4A78]">
                Select a work from the bibliography to inspect its citation tree.
              </Panel>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
