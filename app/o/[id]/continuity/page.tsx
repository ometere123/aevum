"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useWallet } from "../../../../lib/genlayer/wallet";
import { classifyWalletError, confirmWrite } from "../../../../lib/genlayer/transactions";
import { writeContractSafely } from "../../../../lib/genlayer/serialization";
import { readOrganization, readReview } from "../../../../lib/genlayer/reads";
import { env, assertConfigured } from "../../../../lib/config";
import { rememberSubmittedTransaction, updateStoredTransaction } from "../../../../lib/genlayer/transaction-store";

export default function Continuity() {
  const id = usePathname().split("/")[2];
  const { address, ensureWriteReady } = useWallet();
  const [org, setOrg] = useState<Record<string, unknown>>();
  const [review, setReview] = useState<Record<string, unknown>>();
  const [state, setState] = useState("READING CORE");
  const [busy, setBusy] = useState(false);
  const reread = async () => {
    const next = await readOrganization(id); setOrg(next);
    const latest = Number(next.latest_review_id ?? 0);
    if (latest > 0) setReview(await readReview(String(latest))); else setReview(undefined);
    setState("CANONICAL READ");
  };
  useEffect(() => { queueMicrotask(() => { void reread().catch((e) => setState(e instanceof Error ? e.message : "RPC_FAILURE")); }); }, [id]);
  const run = async () => {
    if (busy) return;
    try {
      assertConfigured(); if (!address) throw new Error("Connect a wallet before signing.");
      setBusy(true); setState("AWAITING_SIGNATURE"); const session = await ensureWriteReady();
      const args = [BigInt(id)];
      const hash = await writeContractSafely(session.client, { address: env.coreAddress as `0x${string}`, functionName: "trigger_continuity_review", args, value: 0n });
      const actionKey = `core:${id}:trigger_review`;
      rememberSubmittedTransaction({ actionKey, account: session.address, chainId: "0xf22f", contract: env.coreAddress, method: "trigger_continuity_review", args, hash });
      setState(`CONSENSUS ${hash}`);
      const final = await confirmWrite(session.client, hash, reread);
      updateStoredTransaction(actionKey, session.address, final.stage);
    setState(final.hash ? `${final.stage} ${final.hash}` : final.stage);
    } catch (e) { const classified=classifyWalletError(e); setState(`${classified.stage}: ${classified.error??"write failed"}`); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto min-h-screen max-w-6xl px-6 pb-24 pt-36"><p className="mono text-xs tracking-[.3em] text-[#B8FF5A]">FOLIO 02 / REVIEW CHAMBER / {id}</p><h1 className="serif mt-4 text-6xl">Continuity is evidence.</h1><div className="mt-12 grid gap-5 lg:grid-cols-[1fr_280px]"><div className="border border-[#E9E1CF22] p-8"><p className="mono text-[10px] text-[#777269]">AUTHORITATIVE CORE STATE</p><p className="serif mt-5 text-4xl">{String(org?.status ?? "—")}</p><dl className="mt-4 grid gap-2 text-sm text-[#777269]"><div className="flex justify-between gap-3"><dt>Review due</dt><dd>{String(org && org.last_review !== undefined ? Number(org.last_review) + Number(org.review_interval) : "—")}</dd></div><div className="flex justify-between gap-3"><dt>Pending review</dt><dd>{String(org?.pending_review_id ?? "—")}</dd></div><div className="flex justify-between gap-3"><dt>Review count</dt><dd>{String(org?.review_count ?? "—")}</dd></div><div className="flex justify-between gap-3"><dt>Last outcome</dt><dd>{String(org?.last_outcome ?? "—")}</dd></div></dl><button disabled={busy||!address} onClick={run} className="mt-8 rounded-full bg-[#B8FF5A] px-6 py-3 text-sm font-semibold text-[#0B0B0A] disabled:opacity-40">{address?"Trigger finalized review":"Connect wallet to review"}</button><p className="mono mt-5 break-words text-[10px] text-[#B8784E]">{state}</p></div><aside className="border border-[#E9E1CF22] p-6"><p className="mono text-[10px] text-[#777269]">LATEST REVIEW / ID {String(org?.latest_review_id ?? "—")}</p>{review ? <><p className="serif mt-4 text-3xl">{String(review.outcome || review.review_state)}</p><p className="mono mt-2 text-[10px]">{String(review.review_state)} / {String(review.error_code || "no error")}</p><p className="mt-3 text-xs">{String(review.compact_reason || review.error || "Technical retryable review")}</p><p className="mt-3 text-xs text-[#777269]">Steward after: {String(review.resulting_steward || "—")} / transition: {String(review.transition_applied)}</p><a href={`/review/${review.review_id}`} className="mt-5 inline-block text-xs text-[#B8FF5A]">Open canonical receipt →</a></> : <p className="mt-5 text-sm text-[#777269]">No review receipt.</p>}</aside></div></div>;
}
