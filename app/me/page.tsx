"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { citeAbi } from "@/lib/botchain/abi";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { type BotChainId, isBotChainId } from "@/lib/botchain/chain";
import { describeError } from "@/lib/errors";
import { formatFee, refLabel, type WorkData } from "@/lib/cite";

export default function MePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();

  const currentChainId: BotChainId = isBotChainId(chainId) ? chainId : 968;
  const deployment = getDeployment(currentChainId);
  const deployed = isDeployed(currentChainId);

  // 1. Read user's pending balance
  const {
    data: pendingRaw,
    isLoading: isPendingLoading,
    refetch: refetchPending,
  } = useReadContract({
    address: deployment.address,
    abi: citeAbi,
    functionName: "pending",
    args: address ? [address] : undefined,
    query: { enabled: deployed && Boolean(address) },
  });

  const pendingBalance = pendingRaw !== undefined ? pendingRaw : 0n; // honesty-ok: default display when zero

  // 2. Read author's works
  const { data: myWorkIdsRaw, isLoading: isMyIdsLoading } = useReadContract({
    address: deployment.address,
    abi: citeAbi,
    functionName: "byAuthor",
    args: address ? [address] : undefined,
    query: { enabled: deployed && Boolean(address) },
  });

  const myWorkIds = myWorkIdsRaw ? [...myWorkIdsRaw] : [];

  // Batch read work details
  const { data: myWorksRaw, isLoading: isMyWorksLoading } = useReadContracts({
    contracts: myWorkIds.map((id) => ({
      address: deployment.address,
      abi: citeAbi,
      functionName: "workOf",
      args: [id],
    })),
    query: { enabled: myWorkIds.length > 0 },
  });

  const myWorks: WorkData[] = useMemo(() => {
    if (!myWorksRaw) return [];
    return myWorksRaw
      .map((res, idx) => {
        const w = res.result as any;
        if (!w) return null;
        return {
          id: myWorkIds[idx],
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
  }, [myWorksRaw, myWorkIds]);

  // Contract write for withdraw
  const {
    writeContract: writeWithdraw,
    data: withdrawTxHash,
    isPending: isWithdrawPending,
    error: withdrawError,
  } = useWriteContract();

  const { isLoading: isWithdrawWaiting } = useWaitForTransactionReceipt({
    hash: withdrawTxHash,
  });

  const handleWithdraw = () => {
    if (!isConnected) return;
    try {
      writeWithdraw({
        address: deployment.address,
        abi: citeAbi,
        functionName: "withdraw",
      });
      toast("info", "Withdrawal transaction submitted to wallet.");
    } catch (err) {
      toast("error", describeError(err));
    }
  };

  const totalCitationsEarned = myWorks.reduce((acc, w) => acc + w.citedBy, 0);

  return (
    <PageShell
      title="Scholar Earnings &amp; Literature"
      description="View accrued citation royalties, withdraw pull payment balances, and manage your published works."
    >
      <div className="max-w-[760px] mx-auto flex flex-col gap-8">
        {/* Earnings Card */}
        <Panel variant="scholarly" className="p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[12px] font-mono uppercase tracking-wider text-[#5B4A78] block mb-1">
                Available Citation Royalties
              </span>
              <div className="font-mono text-[32px] font-bold text-[#1E1233]">
                {formatEther(pendingBalance)} BOT
              </div>
              <p className="text-[13px] text-[#5B4A78] mt-1">
                Fees paid by subsequent authors citing your works, ready for one-click withdrawal.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={pendingBalance === 0n || !isConnected}
              loading={isWithdrawPending || isWithdrawWaiting}
              onClick={handleWithdraw}
            >
              {pendingBalance === 0n ? "No Balance" : "Withdraw BOT"}
            </Button>
          </div>

          {withdrawError && (
            <div className="mt-4 p-3.5 bg-[#FCE8E6] text-[#B3261E] border border-[#F5C6CB] rounded-[4px] text-[13px]">
              {describeError(withdrawError)}
            </div>
          )}
        </Panel>

        {/* Scholar Published Works */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-[20px] font-bold text-[#1E1233]">
              Your Published Works ({myWorks.length})
            </h2>
            <Link
              href="/publish"
              className="text-[13px] font-semibold text-[#B5179E] hover:underline"
            >
              + Publish New Work
            </Link>
          </div>

          {!isConnected ? (
            <Panel variant="scholarly" className="text-center py-10 text-[13px] text-[#5B4A78]">
              Connect your wallet to inspect your published works and royalties.
            </Panel>
          ) : isMyIdsLoading || isMyWorksLoading ? (
            <div className="py-10 text-center text-[13px] text-[#5B4A78]">
              Loading your publications…
            </div>
          ) : myWorks.length === 0 ? (
            <Panel variant="scholarly" className="text-center py-12 text-[13px] text-[#5B4A78]">
              <p className="mb-4">You have not published any works yet.</p>
              <Link href="/publish">
                <Button variant="primary" size="sm">
                  Publish Your First Work
                </Button>
              </Link>
            </Panel>
          ) : (
            <div className="flex flex-col gap-3">
              {myWorks.map((w) => (
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
