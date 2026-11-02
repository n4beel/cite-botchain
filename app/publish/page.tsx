"use client";

import { useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useReadContract } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import PublishForm from "@/components/cite/PublishForm";
import Panel from "@/components/ui/Panel";
import { citeAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { activeBotChain } from "@/lib/botchain/chain";
import type { WorkData } from "@/lib/cite";

function PublishContent() {
  const searchParams = useSearchParams();
  const citeParam = searchParams.get("cite");
  const initialCiteId = citeParam ? BigInt(citeParam) : undefined;

  const deployment = getDeployment(activeBotChain.id);
  const deployed = isDeployed(activeBotChain.id);

  // Read latest works for citation picker
  const { data: latestRaw, isLoading } = useReadContract({
    address: deployment.address,
    abi: citeAbi,
    functionName: "latest",
    args: [0n, 50n],
    query: { enabled: deployed },
  });

  const allWorks: WorkData[] = useMemo(() => {
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

  if (!deployed) {
    return (
      <Panel variant="scholarly" className="text-center py-12 max-w-[600px] mx-auto">
        <h2 className="font-serif text-[20px] font-bold text-[#1E1233] mb-2">
          Contract Not Deployed
        </h2>
        <p className="text-[13px] text-[#5B4A78]">
          Connect to BotChain Bohr testnet (Chain ID 968) or start the local stack.
        </p>
      </Panel>
    );
  }

  if (isLoading) {
    return (
      <div className="py-16 text-center text-[14px] text-[#5B4A78] font-serif">
        Loading citation index…
      </div>
    );
  }

  return (
    <PublishForm
      allWorks={allWorks}
      deploymentAddress={deployment.address}
      initialCiteId={initialCiteId}
    />
  );
}

export default function PublishPage() {
  return (
    <PageShell
      title="Publish &amp; Anchor Citation"
      description="Anchor a document hash on-chain, specify a citation fee, and attribute earlier literature."
    >
      <Suspense
        fallback={
          <div className="py-16 text-center text-[14px] text-[#5B4A78] font-serif">
            Loading…
          </div>
        }
      >
        <PublishContent />
      </Suspense>
    </PageShell>
  );
}
