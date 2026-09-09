"use client";

import { useEffect, useMemo, useState } from "react";
import { readOrganization, readReview } from "../../../lib/genlayer/reads";
import { useWallet } from "../../../lib/genlayer/wallet";
import { classifyWalletError, confirmWrite, explorerTx } from "../../../lib/genlayer/transactions";
import { writeContractSafely } from "../../../lib/genlayer/serialization";
import { env } from "../../../lib/config";
import { allStoredTransactions, rememberSubmittedTransaction, updateStoredTransaction } from "../../../lib/genlayer/transaction-store";
import { CoreLifecycleActions } from "../../../components/protocol-actions";

type ReviewRecord = Record<string, any>;

export default function ReviewReceipt({ params }: { params: Promise<{ id: string }> }) {
  const { address, ensureWriteReady } = useWallet();
  const [reviewId, setReviewId] = useState("");
  const [review, setReview] = useState<ReviewRecord>();
  const [organization, setOrganization] = useState<ReviewRecord>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState<string>();

  const load = async (id = reviewId) => {
    if (!id) return;
    const next = await readReview(id);
    setReview(next);
    const organizationId = String(next.organization_id ?? next.org_id ?? next.organizationId ?? "");
    if (organizationId) setOrganization(await readOrganization(organizationId));
    const records = allStoredTransactions().filter((item) => item.method === "trigger_continuity_review");
    const latest = records.sort((a, b) => b.submittedAt - a.submittedAt)[0];
    if (latest) {
      setHash(latest.hash);
      if (/RETRYABLE_ERROR|LLM_MALFORMED|SOURCE_TRANSIENT|SOURCE_UNAVAILABLE|MODEL_TIMEOUT/i.test(`${next.review_state ?? ""} ${next.error_code ?? ""} ${next.outcome ?? ""}`) && latest.stage !== "RETRYABLE_ERROR") {
        updateStoredTransaction(latest.actionKey, latest.account, "RETRYABLE_ERROR", String(next.error_code ?? "Retryable review failure"));
      }
    }
  };

  useEffect(() => { void params.then(({ id }) => { setReviewId(id); void load(id).catch((e) => setError(e instanceof Error ? e.message : "Core read failed")); }); }, [params]);

  const organizationId = String(review?.organization_id ?? review?.org_id ?? review?.organizationId ?? organization?.id ?? "");
  const retryable = /RETRYABLE_ERROR|LLM_MALFORMED|SOURCE_TRANSIENT|SOURCE_UNAVAILABLE|MODEL_TIMEOUT/i.test(`${review?.review_state ?? ""} ${review?.error_code ?? ""} ${review?.outcome ?? ""}`);
  const explanation = retryable ? "The validator-backed review reached consensus on a bounded technical failure. No review outcome was committed; retrying starts a new review transaction." : String(review?.compact_reason ?? review?.error ?? "");
  const storedActionKey = useMemo(() => organizationId ? `core:${organizationId}:trigger_review` : "", [organizationId]);

  const retry = async () => {
    if (busy || !address || !organizationId) return;
    try {
      setBusy(true); setMessage("AWAITING_SIGNATURE"); setError("");
      await load();
      const session = await ensureWriteReady();
      const args = [BigInt(organizationId)];
      const nextHash = await writeContractSafely(session.client, { address: env.coreAddress as `0x${string}`, functionName: "trigger_continuity_review", args, value: 0n });
      rememberSubmittedTransaction({ actionKey: storedActionKey, account: session.address, chainId: "0xf22f", contract: env.coreAddress, method: "trigger_continuity_review", args, hash: nextHash, organizationId, route: `/review/${reviewId}` });
      setHash(nextHash); setMessage(`SUBMITTED ${nextHash}`);
      const final = await confirmWrite(session.client, nextHash, async () => { await load(); });
      updateStoredTransaction(storedActionKey, session.address, final.stage, final.error);
      setMessage(final.stage === "STATE_CONFIRMED" ? "STATE_CONFIRMED" : `${final.stage}: ${final.error ?? "not confirmed"}`);
    } catch (e) {
      const classified = classifyWalletError(e); setMessage(classified.stage); setError(classified.error ?? "Review retry failed");
    } finally { setBusy(false); }
  };

  return <div className="mx-auto min-h-screen max-w-4xl px-6 pb-24 pt-36">
    <p className="mono text-xs tracking-[.3em] text-[#B8FF5A]">PUBLIC RECEIPT / {reviewId || "—"}</p>
    <h1 className="serif mt-4 text-6xl">Review receipt</h1>
    {error && <div className="mt-12 border border-[#B8784E66] p-7 text-sm text-[#B8784E]">{error}</div>}
    {!review && !error && <p className="mt-12 mono text-xs text-[#777269]">READING CANONICAL REVIEW…</p>}
    {review && <div className="mt-12 space-y-4">
      <div className="border border-[#E9E1CF22] p-7">
        <p className="mono text-[10px] text-[#777269]">REVIEW STATE / CONSENSUS RECEIPT</p>
        <p className={`serif mt-3 text-3xl ${retryable ? "text-[#B8784E]" : ""}`}>{retryable ? "RETRYABLE_ERROR" : String(review.outcome ?? review.review_state ?? "—")}</p>
        <p className="mono mt-3 text-xs">{String(review.error_code ?? review.review_state ?? "—")} / transition {String(review.transition_applied ?? false)}</p>
        <p className="mt-5 text-sm text-[#777269]">{explanation}</p>
        {hash && <a className="mono mt-4 block break-all text-xs underline" href={explorerTx(hash)} target="_blank" rel="noreferrer">Transaction {hash} ↗</a>}
        {retryable && <><p className="mt-4 text-xs text-[#B8784E]">No review outcome was committed. The organization remains governed by its canonical pre-review state.</p>{organization?.status !== "REVIEWING" && <button disabled={busy||!address||!organizationId} onClick={retry} className="mt-6 rounded-full bg-[#B8FF5A] px-5 py-3 text-xs font-semibold text-[#0B0B0A] disabled:opacity-40">{busy ? "Retry pending…" : address ? "Retry review" : "Connect wallet to retry"}</button>}{organization?.status === "REVIEWING" && <p className="mt-6 text-xs text-[#777269]">This organization is still REVIEWING. Recover the interrupted review before starting another attempt.</p>}</>}
        {message && <p className="mono mt-4 break-words text-[10px] text-[#B8FF5A]">{message}</p>}
      </div>
      <div className="border border-[#E9E1CF22] p-7"><p className="mono text-[10px] text-[#777269]">CANONICAL ORGANIZATION STATE</p><p className="mt-4 text-sm">Organization {organizationId || "—"} / status {String(organization?.status ?? "—")} / pending review {String(organization?.pending_review_id ?? "—")} / latest review {String(organization?.latest_review_id ?? review.review_id ?? reviewId)}</p></div>
      <CoreLifecycleActions orgId={organizationId} status={String(organization?.status ?? "")} pendingReviewId={Number(organization?.pending_review_id ?? 0)} onChanged={() => load()} />
      <div className="border border-[#E9E1CF22] p-7"><p className="mono text-[10px] text-[#777269]">SOURCE SUPPORT</p>{(review.source_support||[]).map((source:{source_id:number;available:boolean;supports_recent_activity:boolean;supports_mission_alignment:boolean;excerpt:string})=><div key={source.source_id} className="mt-4 border-b border-[#E9E1CF11] pb-3 text-sm"><span className="text-[#B8FF5A]">Source {source.source_id}</span> / {source.available?"available":"unavailable"} / recent {String(source.supports_recent_activity)} / mission {String(source.supports_mission_alignment)}<p className="mt-1 text-xs text-[#777269]">{source.excerpt}</p></div>)}</div>
    </div>}
  </div>;
}
