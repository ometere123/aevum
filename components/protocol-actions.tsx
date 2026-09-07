"use client";

import {keccak256,stringToHex} from "viem";
import {useState} from "react";
import {useWallet} from "../lib/genlayer/wallet";
import {classifyWalletError,confirmWrite,explorerTx} from "../lib/genlayer/transactions";
import {env,assertConfigured} from "../lib/config";
import {depositSchema,releaseSchema,sourceSchema} from "../lib/validation/forms";
import {parseGen,formatGen} from "../lib/genlayer/gen";
import {readAllowance,readCandidates,readOrganization,readReleaseUsed,readSources,readVault} from "../lib/genlayer/reads";

function TxProof({hash}:{hash?:string}){return hash?<a className="mono text-[10px] underline" href={explorerTx(hash)} target="_blank" rel="noreferrer">View transaction on Explorer ↗</a>:null}

export function ProtocolActions({orgId}:{orgId:string}){
  const {address,writeClient,chainOk}=useWallet();
  const [state,setState]=useState("");const [tx,setTx]=useState<string>();const [busy,setBusy]=useState(false);
  const [source,setSource]=useState({label:"",url:"",purpose:"official_site"});
  const [manifesto,setManifesto]=useState("");

  const write=async(functionName:string,args:unknown[],verify:()=>Promise<void>)=>{
    if(busy)return;
    try{
      assertConfigured();if(!chainOk)throw new Error("WRONG_NETWORK: switch wallet to Studionet 61999");if(!address||!writeClient)throw new Error("Connect a wallet before signing.");
      setBusy(true);setState("AWAITING_SIGNATURE");setTx(undefined);await writeClient.connect("studionet");
      const hash=await writeClient.writeContract({address:env.coreAddress as `0x${string}`,functionName,args});setTx(hash);setState(`SUBMITTED ${hash}`);
      const final=await confirmWrite(writeClient,hash,verify);setState(final.stage==="EXECUTION_CONFIRMED"?final.stage:`${final.stage}: ${final.error??"not confirmed"}`);
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
      <button disabled={busy} onClick={addSource} className="rounded-full border border-[#E9E1CF44] px-4 py-3 text-xs disabled:opacity-40">Register source</button>
      <input aria-label="successor manifesto URL" value={manifesto} onChange={e=>setManifesto(e.target.value)} placeholder="https://candidate.example/manifesto" className="border-b border-[#E9E1CF44] bg-transparent p-3 text-xs md:col-span-2"/>
      <button disabled={busy} onClick={nominate} className="rounded-full border border-[#E9E1CF44] px-4 py-3 text-xs disabled:opacity-40">Self-nominate connected wallet</button>
      <button disabled={busy} onClick={seal} className="rounded-full border border-[#E9E1CF44] px-4 py-3 text-xs disabled:opacity-40">Seal charter</button>
    </div>
    <p className="mono mt-4 break-words text-[10px] text-[#B8FF5A]">{state}</p><TxProof hash={tx}/>
  </div>;
}

export function VaultActions({orgId,onChanged}:{orgId:string,onChanged?:()=>Promise<void>}){
  const {address,writeClient,chainOk}=useWallet();
  const [state,setState]=useState("");const [tx,setTx]=useState<string>();const [busy,setBusy]=useState(false);
  const [depositAmount,setDepositAmount]=useState("0.001");
  const [release,setRelease]=useState({recipient:"",amountGen:"0.001",memo:"mission release"});

  const preflight=()=>{assertConfigured();if(!chainOk)throw new Error("WRONG_NETWORK: switch wallet to Studionet 61999");if(!address||!writeClient)throw new Error("Connect a wallet before signing.");return writeClient};
  const finish=async(hash:`0x${string}`,verify:()=>Promise<void>)=>{setTx(hash);setState(`SUBMITTED ${hash}`);const client=writeClient!;const final=await confirmWrite(client,hash,async()=>{await verify();await onChanged?.()});setState(final.stage==="EXECUTION_CONFIRMED"?final.stage:`${final.stage}: ${final.error??"not confirmed"}`)};

  const deposit=async()=>{if(busy)return;const parsed=depositSchema.safeParse({amountGen:depositAmount});if(!parsed.success){setState(parsed.error.issues[0]?.message??"Invalid deposit");return}try{const client=preflight();const amount=parseGen(parsed.data.amountGen);const before=await readVault(orgId);setBusy(true);setState("AWAITING_SIGNATURE");await client.connect("studionet");const hash=await client.writeContract({address:env.vaultAddress as `0x${string}`,functionName:"deposit",args:[BigInt(orgId)],value:amount});await finish(hash,async()=>{const after=await readVault(orgId);if(BigInt(after.balance)!==BigInt(before.balance)+amount)throw new Error("STATE_MISMATCH: Vault balance did not increase by the exact deposit")})}catch(error){const classified=classifyWalletError(error);setState(`${classified.stage}: ${classified.error??"deposit failed"}`)}finally{setBusy(false)}};

  const releaseFunds=async()=>{if(busy)return;const candidate={...release,recipient:release.recipient||address||""};const parsed=releaseSchema.safeParse(candidate);if(!parsed.success){setState(parsed.error.issues[0]?.message??"Invalid release");return}try{const client=preflight();const amount=parseGen(parsed.data.amountGen);const memoHash=keccak256(stringToHex(`${orgId}:${parsed.data.recipient.toLowerCase()}:${parsed.data.amountGen}:${parsed.data.memo.trim()}`));const before=await readVault(orgId);setBusy(true);setState(`AWAITING_SIGNATURE / ${formatGen(amount)} GEN / ${amount} wei / memo ${memoHash}`);await client.connect("studionet");const hash=await client.writeContract({address:env.vaultAddress as `0x${string}`,functionName:"release",args:[BigInt(orgId),parsed.data.recipient,amount,memoHash]});await finish(hash,async()=>{const [after,used]=await Promise.all([readVault(orgId),readReleaseUsed(orgId,memoHash)]);if(BigInt(after.balance)!==BigInt(before.balance)-amount)throw new Error("STATE_MISMATCH: Vault balance did not decrease by the release amount");if(!used)throw new Error("STATE_MISMATCH: memo replay guard was not persisted")})}catch(error){const classified=classifyWalletError(error);setState(`${classified.stage}: ${classified.error??"release failed"}`)}finally{setBusy(false)}};

  const recover=async()=>{if(busy)return;try{const client=preflight();const before=await readVault(orgId);if(BigInt(before.balance)<=0n)throw new Error("Vault is already clear.");setBusy(true);setState("AWAITING_SIGNATURE / dormant treasury recovery");await client.connect("studionet");const hash=await client.writeContract({address:env.vaultAddress as `0x${string}`,functionName:"recover_dormant",args:[BigInt(orgId)]});await finish(hash,async()=>{const after=await readVault(orgId);if(BigInt(after.balance)!==0n)throw new Error("STATE_MISMATCH: dormant recovery did not clear the Vault")})}catch(error){const classified=classifyWalletError(error);setState(`${classified.stage}: ${classified.error??"recovery failed"}`)}finally{setBusy(false)}};

  return <div className="mt-5 grid gap-5">
    <div className="grid gap-3 md:grid-cols-[1fr_auto]"><label><span className="mono text-[10px] text-[#777269]">DEPOSIT AMOUNT / GEN</span><input aria-label="deposit GEN amount" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} inputMode="decimal" className="mt-2 w-full border-b border-[#E9E1CF44] bg-transparent p-3 text-xs"/></label><button disabled={busy} onClick={deposit} className="self-end rounded-full bg-[#B8FF5A] px-5 py-3 text-xs font-semibold text-[#0B0B0A] disabled:opacity-40">Deposit GEN</button></div>
    <div className="grid gap-3 md:grid-cols-2"><input aria-label="release recipient" value={release.recipient} onChange={e=>setRelease({...release,recipient:e.target.value})} className="border-b border-[#E9E1CF44] bg-transparent p-3 text-xs" placeholder={address??"Recipient 0x..."}/><input aria-label="release amount GEN" value={release.amountGen} onChange={e=>setRelease({...release,amountGen:e.target.value})} inputMode="decimal" className="border-b border-[#E9E1CF44] bg-transparent p-3 text-xs" placeholder="Amount in GEN"/><input aria-label="release memo" value={release.memo} onChange={e=>setRelease({...release,memo:e.target.value})} className="border-b border-[#E9E1CF44] bg-transparent p-3 text-xs md:col-span-2" placeholder="Human-readable release memo"/><button disabled={busy} onClick={releaseFunds} className="rounded-full border border-[#E9E1CF44] px-5 py-3 text-xs disabled:opacity-40">Release with steward permission</button><button disabled={busy} onClick={recover} className="rounded-full border border-[#B8784E] px-5 py-3 text-xs text-[#B8784E] disabled:opacity-40">Recover dormant treasury when eligible</button></div>
    <p className="mono break-words text-[10px] text-[#B8FF5A]">{state}</p><TxProof hash={tx}/>
  </div>;
}
