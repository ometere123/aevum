"use client";

import {keccak256,stringToHex} from "viem";
import {createClient} from "genlayer-js";
import {useState} from "react";
import {useWallet} from "../lib/genlayer/wallet";
import {classifyWalletError,confirmWrite,explorerTx,findTriggeredTransfer,type TriggeredTransfer} from "../lib/genlayer/transactions";
import {env,assertConfigured} from "../lib/config";
import {depositSchema,releaseSchema,sourceSchema} from "../lib/validation/forms";
import {parseGen,formatGen} from "../lib/genlayer/gen";
import {readAllowance,readCandidates,readOrganization,readReleaseUsed,readSources,readVault} from "../lib/genlayer/reads";
import {rememberSubmittedTransaction,updateStoredTransaction,updateStoredTransactionDetails} from "../lib/genlayer/transaction-store";
import {writeContractSafely} from "../lib/genlayer/serialization";
import {assertClosedOrganizationReadback, assertRecoveredReviewReadback} from "../lib/genlayer/core-actions";

type CalldataEncodable = string | bigint;

function TxProof({hash,child}:{hash?:string,child?:TriggeredTransfer}){return <div className="space-y-1">{hash&&<a className="mono block text-[10px] underline" href={explorerTx(hash)} target="_blank" rel="noreferrer">Parent transaction ↗</a>}{child&&<><p className="mono text-[10px] text-[#B8FF5A]">Child transfer · {formatGen(child.value)} GEN · {child.recipient}</p><a className="mono block text-[10px] underline" href={explorerTx(child.hash)} target="_blank" rel="noreferrer">Child transaction ↗</a></>}</div>}

export function ProtocolActions({orgId}:{orgId:string}){
  const {address,ensureWriteReady}=useWallet();
  const [state,setState]=useState("");const [tx,setTx]=useState<string>();const [busy,setBusy]=useState(false);
  const [source,setSource]=useState({label:"",url:"",purpose:"official_site"});
  const [manifesto,setManifesto]=useState("");

  const write=async(functionName:string,args:CalldataEncodable[],verify:()=>Promise<void>)=>{
    if(busy)return;
    try{
      assertConfigured();
      setBusy(true);setState("AWAITING_SIGNATURE");setTx(undefined);const session=await ensureWriteReady();
      const hash=await writeContractSafely(session.client,{address:env.coreAddress as `0x${string}`,functionName,args,value:0n});const actionKey=`core:${orgId}:${functionName}`;rememberSubmittedTransaction({actionKey,account:session.address,chainId:"0xf22f",contract:env.coreAddress,method:functionName,args,hash,organizationId:orgId,route:`/o/${orgId}/charter`});setTx(hash);setState(`SUBMITTED ${hash}`);
      const final=await confirmWrite(session.client,hash,verify);updateStoredTransaction(actionKey,session.address,final.stage,final.error);setState(final.stage==="STATE_CONFIRMED"?final.stage:`${final.stage}: ${final.error??"not confirmed"}`);
    }catch(error){const classified=classifyWalletError(error);setState(`${classified.stage}: ${classified.error??"write failed"}`)}finally{setBusy(false)}
  };

  const addSource=async()=>{
    const parsed=sourceSchema.safeParse(source);if(!parsed.success){setState(parsed.error.issues[0]?.message??"Check source");return}
    const before=await readOrganization(orgId);
    await write("add_source",[BigInt(orgId),parsed.data.label,parsed.data.url,parsed.data.purpose],async()=>{
      const after=await readOrganization(orgId);if(Number(after.source_count)!==Number(before.source_count)+1)throw new Error("STATE_MISMATCH: source count did not increase");
      const sources=await readSources(orgId,Number(after.source_count));if(!sources.some((x:{url:string})=>x.url===parsed.data.url))throw new Error("STATE_MISMATCH: registered source not found in canonical Core state");
    });
  };

  const seal=async()=>write("seal_organization",[BigInt(orgId)],async()=>{const org=await readOrganization(orgId);if(!org.sealed||org.status!=="ACTIVE"||!org.definition_hash)throw new Error("STATE_MISMATCH: charter did not become sealed ACTIVE state")});

  const nominate=async()=>{
    if(!address){setState("Connect a wallet before self-nominating.");return}if(!manifesto.startsWith("https://")){setState("Manifesto must be a public HTTPS URL.");return}
    const before=await readOrganization(orgId);
    await write("nominate_successor",[BigInt(orgId),address,manifesto],async()=>{
      const after=await readOrganization(orgId);if(Number(after.candidate_count)!==Number(before.candidate_count)+1)throw new Error("STATE_MISMATCH: candidate count did not increase");
      const candidates=await readCandidates(orgId,Number(after.candidate_count));if(!candidates.some((x:{candidate:string,manifesto_url:string,active:boolean})=>x.active&&x.candidate.toLowerCase()===address.toLowerCase()&&x.manifesto_url===manifesto))throw new Error("STATE_MISMATCH: self-nomination not found in canonical Core state");
    });
  };

  return <div className="mt-10 border-t border-[#E9E1CF22] pt-6">
    <div className="grid gap-3 md:grid-cols-2">
      <input aria-label="source label" value={source.label} onChange={e=>setSource({...source,label:e.target.value})} placeholder="Source label" className="border-b border-[#E9E1CF44] bg-transparent p-3 text-xs"/>
      <input aria-label="source URL" value={source.url} onChange={e=>setSource({...source,url:e.target.value})} placeholder="https://source.example/path" className="border-b border-[#E9E1CF44] bg-transparent p-3 text-xs"/>
      <select aria-label="source purpose" value={source.purpose} onChange={e=>setSource({...source,purpose:e.target.value})} className="border border-[#E9E1CF22] bg-[#0B0B0A] p-3 text-xs"><option value="official_site">official_site</option><option value="repo">repo</option><option value="governance">governance</option><option value="activity_feed">activity_feed</option></select>
      <button disabled={busy||!address} onClick={addSource} className="rounded-full border border-[#E9E1CF44] px-4 py-3 text-xs disabled:opacity-40">Register source</button>
      <input aria-label="successor manifesto URL" value={manifesto} onChange={e=>setManifesto(e.target.value)} placeholder="https://candidate.example/manifesto" className="border-b border-[#E9E1CF44] bg-transparent p-3 text-xs md:col-span-2"/>
      <button disabled={busy||!address} onClick={nominate} className="rounded-full border border-[#E9E1CF44] px-4 py-3 text-xs disabled:opacity-40">Self-nominate connected wallet</button>
      <button disabled={busy||!address} onClick={seal} className="rounded-full border border-[#E9E1CF44] px-4 py-3 text-xs disabled:opacity-40">Seal charter</button>
    </div>
    <p className="mono mt-4 break-words text-[10px] text-[#B8FF5A]">{state}</p><TxProof hash={tx}/>
  </div>;
}

type CoreLifecycleActionProps = {
  orgId: string;
  status?: string;
  pendingReviewId?: number;
  onChanged?: () => Promise<void>;
};

/** Wallet-backed recovery/closure actions. Both writes verify the exact
 * canonical transition after the Studionet transaction is finalized. */
export function CoreLifecycleActions({orgId, status, pendingReviewId = 0, onChanged}: CoreLifecycleActionProps) {
  const {address, ensureWriteReady} = useWallet();
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);

  const write = async (method: "recover_review" | "close_organization", verify: (before: Record<string, unknown>) => Promise<void>) => {
    if (busy || !address) return;
    const actionKey = `core:${orgId}:${method}`;
    try {
      assertConfigured();
      const before = await readOrganization(orgId);
      setBusy(true);
      setState("AWAITING_SIGNATURE");
      const session = await ensureWriteReady();
      const args = [BigInt(orgId)];
      const hash = await writeContractSafely(session.client, {
        address: env.coreAddress as `0x${string}`,
        functionName: method,
        args,
        value: 0n,
      });
      rememberSubmittedTransaction({
        actionKey,
        account: session.address,
        chainId: "0xf22f",
        contract: env.coreAddress,
        method,
        args,
        hash,
        organizationId: orgId,
        route: `/o/${orgId}`,
      });
      setState(`SUBMITTED ${hash}`);
      const final = await confirmWrite(session.client, hash, async () => {
        await verify(before);
        await onChanged?.();
      });
      updateStoredTransaction(actionKey, session.address, final.stage, final.error);
      setState(final.hash ? `${final.stage} ${final.hash}${final.error ? ` / ${final.error}` : ""}` : final.stage);
    } catch (error) {
      const classified = classifyWalletError(error);
      setState(`${classified.stage}: ${classified.error ?? "write failed"}`);
    } finally {
      setBusy(false);
    }
  };

  const recover = () => write("recover_review", async (before) => assertRecoveredReviewReadback(before, await readOrganization(orgId)));

  const close = () => write("close_organization", async () => assertClosedOrganizationReadback(await readOrganization(orgId)));

  const recoveryAvailable = status === "REVIEWING" && pendingReviewId > 0;
  const closeAvailable = status === "DORMANT";
  if (!recoveryAvailable && !closeAvailable && !state) return null;

  return <div className="mt-8 border-t border-[#E9E1CF22] pt-6">
    <p className="mono text-[10px] text-[#777269]">RECOVERY / CLOSURE ACTIONS</p>
    <div className="mt-4 flex flex-wrap gap-3">
      {recoveryAvailable && <button aria-label="recover interrupted review" disabled={busy || !address} onClick={recover} className="rounded-full border border-[#B8784E] px-5 py-3 text-xs text-[#B8784E] disabled:opacity-40">{busy ? "Recovering…" : "Recover interrupted review"}</button>}
      {closeAvailable && <button aria-label="close organization" disabled={busy || !address} onClick={close} className="rounded-full border border-[#E9E1CF44] px-5 py-3 text-xs disabled:opacity-40">{busy ? "Closing…" : "Close organization"}</button>}
    </div>
    {recoveryAvailable && <p className="mt-3 text-xs text-[#777269]">This clears a review that has remained pending beyond the sealed recovery delay and restores its exact prior state.</p>}
    {closeAvailable && <p className="mt-3 text-xs text-[#777269]">Closure remains subject to the canonical delay, withdrawn candidates, and zero Vault balance.</p>}
    {state && <p className="mono mt-4 break-words text-[10px] text-[#B8FF5A]">{state}</p>}
  </div>;
}

export function VaultActions({orgId,onChanged,canDeposit=true,canRelease=true,canRecover=false}:{orgId:string,onChanged?:()=>Promise<void>,canDeposit?:boolean,canRelease?:boolean,canRecover?:boolean}){
  const {address,ensureWriteReady}=useWallet();
  const [state,setState]=useState("");const [tx,setTx]=useState<string>();const [child,setChild]=useState<TriggeredTransfer>();const [busy,setBusy]=useState(false);
  const [depositAmount,setDepositAmount]=useState("0.001");
  const [release,setRelease]=useState({recipient:"",amountGen:"0.001",memo:"mission release"});

  const preflight=async()=>{assertConfigured();return ensureWriteReady()};
  const finish=async(client:ReturnType<typeof createClient>,hash:`0x${string}`,verify:()=>Promise<void>,actionKey:string,method:string,args:unknown[],account:string,transfer?:{recipient:string,value:bigint},amount?:bigint)=>{rememberSubmittedTransaction({actionKey,account,chainId:"0xf22f",contract:env.vaultAddress,method,args,hash,organizationId:orgId,route:`/o/${orgId}/treasury`,...(amount!==undefined?{amountWei:amount.toString(),amountGen:formatGen(amount)}:{})});setTx(hash);setState(`SUBMITTED ${hash}`);const final=await confirmWrite(client,hash,async()=>{await verify();await onChanged?.()});let observed:TriggeredTransfer|undefined;if(final.stage==="STATE_CONFIRMED"&&transfer){try{observed=await findTriggeredTransfer(client,hash,transfer.recipient,transfer.value);if(!observed)setState("STATE_CONFIRMED / child transfer not yet observed")}catch{setState("STATE_CONFIRMED / child transfer not yet observed")}}updateStoredTransaction(actionKey,account,final.stage,final.error);if(observed)updateStoredTransactionDetails(actionKey,account,{childHash:observed.hash,childRecipient:observed.recipient,childValueWei:observed.value.toString()});setState(final.stage==="STATE_CONFIRMED"?final.stage:`${final.stage}: ${final.error??"not confirmed"}`)};

  const deposit=async()=>{if(busy)return;const parsed=depositSchema.safeParse({amountGen:depositAmount});if(!parsed.success){setState(parsed.error.issues[0]?.message??"Invalid deposit");return}try{const session=await preflight();const client=session.client;const amount=parseGen(parsed.data.amountGen);const before=await readVault(orgId);setBusy(true);setState(`AWAITING_SIGNATURE / ${formatGen(amount)} GEN / ${amount} wei`);const args=[BigInt(orgId)];const hash=await writeContractSafely(client,{address:env.vaultAddress as `0x${string}`,functionName:"deposit",args,value:amount});await finish(client,hash,async()=>{const after=await readVault(orgId);if(BigInt(after.balance)!==BigInt(before.balance)+amount||BigInt(after.funded)!==BigInt(before.funded)+amount)throw new Error("STATE_MISMATCH: Vault funded/balance did not increase by the exact deposit")},`vault:${orgId}:deposit`,`deposit`,args,session.address,undefined,amount)}catch(error){const classified=classifyWalletError(error);setState(`${classified.stage}: ${classified.error??"deposit failed"}`)}finally{setBusy(false)}};

  const releaseFunds=async()=>{if(busy)return;const candidate={...release,recipient:release.recipient||address||""};const parsed=releaseSchema.safeParse(candidate);if(!parsed.success){setState(parsed.error.issues[0]?.message??"Invalid release");return}try{const session=await preflight();const client=session.client;const amount=parseGen(parsed.data.amountGen);const memoHash=keccak256(stringToHex(`${orgId}:${parsed.data.recipient.toLowerCase()}:${parsed.data.amountGen}:${parsed.data.memo.trim()}`));const before=await readVault(orgId);setBusy(true);setState(`AWAITING_SIGNATURE / ${formatGen(amount)} GEN / ${amount} wei / memo ${memoHash}`);const args=[BigInt(orgId),parsed.data.recipient,amount,memoHash];const hash=await writeContractSafely(client,{address:env.vaultAddress as `0x${string}`,functionName:"release",args,value:0n});await finish(client,hash,async()=>{const [after,used]=await Promise.all([readVault(orgId),readReleaseUsed(orgId,memoHash)]);if(BigInt(after.balance)!==BigInt(before.balance)-amount||BigInt(after.released)!==BigInt(before.released)+amount)throw new Error("STATE_MISMATCH: Vault release accounting did not reconcile");if(!used)throw new Error("STATE_MISMATCH: memo replay guard was not persisted")},`vault:${orgId}:release:${memoHash}`,"release",args,session.address,{recipient:parsed.data.recipient,value:amount},amount)}catch(error){const classified=classifyWalletError(error);setState(`${classified.stage}: ${classified.error??"release failed"}`)}finally{setBusy(false)}};

  const recover=async()=>{if(busy||!canRecover)return;try{const session=await preflight();const client=session.client;const before=await readVault(orgId);const amount=BigInt(before.balance);if(amount<=0n)throw new Error("Vault is already clear.");setBusy(true);setState(`AWAITING_SIGNATURE / ${formatGen(amount)} GEN / ${amount} wei / dormant treasury recovery`);const args=[BigInt(orgId)];const hash=await writeContractSafely(client,{address:env.vaultAddress as `0x${string}`,functionName:"recover_dormant",args,value:0n});await finish(client,hash,async()=>{const after=await readVault(orgId);if(BigInt(after.balance)!==0n)throw new Error("STATE_MISMATCH: dormant recovery did not clear the Vault")},`vault:${orgId}:recover`,"recover_dormant",args,session.address,undefined,amount)}catch(error){const classified=classifyWalletError(error);setState(`${classified.stage}: ${classified.error??"recovery failed"}`)}finally{setBusy(false)}};

  return <div className="mt-5 grid gap-5">
    <div className="grid gap-3 md:grid-cols-[1fr_auto]"><label><span className="mono text-[10px] text-[#777269]">DEPOSIT AMOUNT / GEN</span><input aria-label="deposit GEN amount" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} inputMode="decimal" className="mt-2 w-full border-b border-[#E9E1CF44] bg-transparent p-3 text-xs"/></label><button disabled={busy||!address||!canDeposit} onClick={deposit} className="self-end rounded-full bg-[#B8FF5A] px-5 py-3 text-xs font-semibold text-[#0B0B0A] disabled:opacity-40">Deposit GEN</button></div>
    {!canDeposit&&<p className="mono text-[10px] text-[#777269]">Deposits are available only while the sealed organization is active.</p>}
    <div className="grid gap-3 md:grid-cols-2"><input aria-label="release recipient" value={release.recipient} onChange={e=>setRelease({...release,recipient:e.target.value})} className="border-b border-[#E9E1CF44] bg-transparent p-3 text-xs" placeholder={address??"Recipient 0x..."}/><input aria-label="release amount GEN" value={release.amountGen} onChange={e=>setRelease({...release,amountGen:e.target.value})} inputMode="decimal" className="border-b border-[#E9E1CF44] bg-transparent p-3 text-xs" placeholder="Amount in GEN"/><input aria-label="release memo" value={release.memo} onChange={e=>setRelease({...release,memo:e.target.value})} className="border-b border-[#E9E1CF44] bg-transparent p-3 text-xs md:col-span-2" placeholder="Human-readable release memo"/><button disabled={busy||!address||!canRelease} onClick={releaseFunds} className="rounded-full border border-[#E9E1CF44] px-5 py-3 text-xs disabled:opacity-40">Release with steward permission</button><button disabled={busy||!address||!canRecover} onClick={recover} className="rounded-full border border-[#B8784E] px-5 py-3 text-xs text-[#B8784E] disabled:opacity-40">Recover dormant treasury when eligible</button></div>
    {!canRelease&&<p className="mono text-[10px] text-[#777269]">Release is disabled until Core reports ACTIVE with spending enabled.</p>}{!canRecover&&<p className="mono text-[10px] text-[#777269]">Dormant recovery is unavailable until the authoritative Core eligibility check passes.</p>}
    <p className="mono break-words text-[10px] text-[#B8FF5A]">{state}</p><TxProof hash={tx} child={child}/>
  </div>;
}
