"use client";

import { useState } from "react";
import { useWallet } from "../lib/genlayer/wallet";
import { classifyWalletError, confirmWrite, explorerTx } from "../lib/genlayer/transactions";
import { writeContractSafely } from "../lib/genlayer/serialization";
import { env, assertConfigured } from "../lib/config";
import { readCandidates, readOrganization } from "../lib/genlayer/reads";
import { rememberSubmittedTransaction, updateStoredTransaction } from "../lib/genlayer/transaction-store";

export function SuccessorActions({ orgId, candidateId, candidate, active }: { orgId: string; candidateId: number; candidate: string; active: boolean }) {
  const { address, ensureWriteReady } = useWallet();
  const [state, setState] = useState("");
  const [hash, setHash] = useState<string>();
  const [busy, setBusy] = useState(false);
  const mine = Boolean(address && address.toLowerCase() === candidate.toLowerCase());

  const withdraw = async () => {
    if (busy) return;
    try {
      assertConfigured();
      if (!address) throw new Error("Connect the nominated wallet to withdraw.");
      if (!mine) throw new Error("Only the nominated wallet can withdraw this nomination.");
      setBusy(true); setState("AWAITING_SIGNATURE");
      const session = await ensureWriteReady();
      const args = [BigInt(orgId), BigInt(candidateId)];
      const tx = await writeContractSafely(session.client, { address: env.coreAddress as `0x${string}`, functionName: "withdraw_nomination", args, value: 0n });
      const actionKey = `core:${orgId}:withdraw:${candidateId}`;
      rememberSubmittedTransaction({ actionKey, account: session.address, chainId: "0xf22f", contract: env.coreAddress, method: "withdraw_nomination", args, hash: tx });
      setHash(tx); setState(`SUBMITTED ${tx}`);
      const final = await confirmWrite(session.client, tx, async () => {
        const org = await readOrganization(orgId);
        const candidates = await readCandidates(orgId, Number(org.candidate_count));
        const updated = candidates.find((x: { candidate_id: number }) => Number(x.candidate_id) === candidateId);
        if (!updated || updated.active) throw new Error("STATE_MISMATCH: nomination is still active after finalized withdrawal");
      });
      updateStoredTransaction(actionKey, session.address, final.stage);
      setState(final.stage === "EXECUTION_CONFIRMED" ? final.stage : `${final.stage}: ${final.error ?? "not confirmed"}`);
    } catch (error) {
      const classified = classifyWalletError(error);
      setState(`${classified.stage}: ${classified.error ?? "withdrawal failed"}`);
    } finally { setBusy(false); }
  };

  return <div className="mt-4"><button disabled={!active || !mine || busy} onClick={withdraw} className="rounded-full border border-[#E9E1CF44] px-4 py-2 text-xs disabled:opacity-30">Withdraw my nomination</button>{state && <p className="mono mt-2 break-words text-[9px] text-[#B8784E]">{state}</p>}{hash && <a className="mono mt-1 block text-[9px] underline" href={explorerTx(hash)} target="_blank" rel="noreferrer">Explorer ↗</a>}</div>;
}
