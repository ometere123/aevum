"use client";

import Link from "next/link";
import {useState} from "react";
import {useWallet} from "../../lib/genlayer/wallet";
import {charterSchema} from "../../lib/validation/forms";
import {classifyWalletError,confirmWrite,explorerTx} from "../../lib/genlayer/transactions";
import {env,assertConfigured} from "../../lib/config";
import {parseGen} from "../../lib/genlayer/gen";
import {readOrganization,readOrganizations} from "../../lib/genlayer/reads";
import {rememberSubmittedTransaction,updateStoredTransaction} from "../../lib/genlayer/transaction-store";
import {writeContractSafely} from "../../lib/genlayer/serialization";

export default function Create(){
  const {address,ensureWriteReady}=useWallet();
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [tx,setTx]=useState<string>();
  const [createdId,setCreatedId]=useState<string>();
  const [form,setForm]=useState({
    name:"",
    mission:"",
    successionCriteria:"A successor must publicly commit to continuing the sealed mission and demonstrate credible responsibility for maintaining it.",
    reviewInterval:604800,
    dormancyThreshold:2592000,
    epochSeconds:2592000,
    releaseCapGen:"1",
    recoveryRecipient:"",
    closureDelay:604800,
  });

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(busy)return;
    const candidate={...form,recoveryRecipient:form.recoveryRecipient||address||""};
    const parsed=charterSchema.safeParse(candidate);
    if(!parsed.success){setMessage(parsed.error.issues[0]?.message??"Check the charter");return}
    let submittedHash: string | undefined;
    try{
      assertConfigured();
      if(!address) throw new Error("Connect a Studionet wallet to write the charter.");
      setBusy(true);setMessage("AWAITING_SIGNATURE");setCreatedId(undefined);
      const before=await readOrganizations();
      const session=await ensureWriteReady();
      const args=[
          parsed.data.name,
          parsed.data.mission,
          parsed.data.successionCriteria,
          BigInt(parsed.data.reviewInterval),
          BigInt(parsed.data.dormancyThreshold),
          BigInt(parsed.data.epochSeconds),
          parseGen(parsed.data.releaseCapGen),
          parsed.data.recoveryRecipient,
          BigInt(parsed.data.closureDelay),
        ];
      const hash=await writeContractSafely(session.client,{
        address:env.coreAddress as `0x${string}`,
        functionName:"create_organization",
        args,
        value:0n,
      });
      const actionKey="core:create_organization";rememberSubmittedTransaction({actionKey,account:session.address,chainId:"0xf22f",contract:env.coreAddress,method:"create_organization",args,hash});
      submittedHash=hash;setTx(hash);setMessage(`SUBMITTED ${hash}`);
      let confirmedId="";
      const final=await confirmWrite(session.client,hash,async()=>{
        const after=await readOrganizations();
        if(after.length!==before.length+1) throw new Error("STATE_MISMATCH: organization count did not increase by one");
        const newest=after[after.length-1];
        confirmedId=String(newest.org_id);
        const canonical=await readOrganization(confirmedId);
        if(String(canonical.creator).toLowerCase()!==address.toLowerCase()||canonical.name!==parsed.data.name) throw new Error("STATE_MISMATCH: canonical organization does not match the submitted charter");
      });
      updateStoredTransaction(actionKey,session.address,final.stage);if(final.stage==="STATE_CONFIRMED"){setCreatedId(confirmedId);setMessage(`STATE_CONFIRMED / organization ${confirmedId}`)}else setMessage(`${final.stage}: ${final.error??"transaction not confirmed"}`);
    }catch(error){
      if(submittedHash){
        setTx(submittedHash);
        setMessage(`OUTCOME_UNKNOWN: transaction ${submittedHash} was submitted. Check canonical organization state before retrying.`);
      } else {
        const state=classifyWalletError(error);setMessage(`${state.stage}: ${state.error??"write failed"}`);
      }
    }finally{setBusy(false)}
  };

  const input="mt-2 w-full border-b border-[#E9E1CF44] bg-transparent py-3 outline-none";
  return <div className="mx-auto min-h-screen max-w-5xl px-6 pb-24 pt-36">
    <div className="mb-12 max-w-2xl"><p className="mono text-xs tracking-[.3em] text-[#B8FF5A]">FOUNDATION / DRAFT CHARTER</p><h1 className="serif mt-4 text-6xl">Found a continuity machine.</h1></div>
    <form onSubmit={submit} className="grid gap-5 rounded-2xl border border-[#E9E1CF22] bg-[#E9E1CF08] p-6 md:grid-cols-2">
      <label className="md:col-span-2"><span className="mono text-[10px] text-[#777269]">ORGANIZATION NAME</span><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className={input}/></label>
      <label className="md:col-span-2"><span className="mono text-[10px] text-[#777269]">MISSION</span><textarea required rows={5} value={form.mission} onChange={e=>setForm({...form,mission:e.target.value})} className="mt-2 w-full border border-[#E9E1CF22] bg-[#0B0B0A] p-3 outline-none"/></label>
      <label className="md:col-span-2"><span className="mono text-[10px] text-[#777269]">SUCCESSION CRITERIA</span><textarea required rows={4} value={form.successionCriteria} onChange={e=>setForm({...form,successionCriteria:e.target.value})} className="mt-2 w-full border border-[#E9E1CF22] bg-[#0B0B0A] p-3 outline-none"/></label>
      <label><span className="mono text-[10px] text-[#777269]">REVIEW INTERVAL (SEC)</span><input type="number" required value={form.reviewInterval} onChange={e=>setForm({...form,reviewInterval:Number(e.target.value)})} className={input}/></label>
      <label><span className="mono text-[10px] text-[#777269]">DORMANCY THRESHOLD (SEC)</span><input type="number" required value={form.dormancyThreshold} onChange={e=>setForm({...form,dormancyThreshold:Number(e.target.value)})} className={input}/></label>
      <label><span className="mono text-[10px] text-[#777269]">TREASURY EPOCH (SEC)</span><input type="number" required value={form.epochSeconds} onChange={e=>setForm({...form,epochSeconds:Number(e.target.value)})} className={input}/></label>
      <label><span className="mono text-[10px] text-[#777269]">EPOCH RELEASE CAP (GEN)</span><input required value={form.releaseCapGen} onChange={e=>setForm({...form,releaseCapGen:e.target.value})} inputMode="decimal" className={input}/></label>
      <label><span className="mono text-[10px] text-[#777269]">RECOVERY RECIPIENT</span><input value={form.recoveryRecipient} onChange={e=>setForm({...form,recoveryRecipient:e.target.value})} placeholder={address??"0x..."} className={input}/></label>
      <label><span className="mono text-[10px] text-[#777269]">DORMANT CLOSURE DELAY (SEC)</span><input type="number" required value={form.closureDelay} onChange={e=>setForm({...form,closureDelay:Number(e.target.value)})} className={input}/></label>
      <div className="md:col-span-2 border-t border-[#E9E1CF22] pt-5"><p className="mono break-words text-[10px] text-[#B8784E]">{message}</p>{tx&&<a className="mono mt-2 block text-[10px] underline" href={explorerTx(tx)} target="_blank" rel="noreferrer">View transaction on Explorer ↗</a>}{createdId&&<Link className="mt-4 inline-block text-sm underline" href={`/o/${createdId}`}>Open organization {createdId} →</Link>}<button disabled={busy||!address} className="mt-5 block rounded-full bg-[#B8FF5A] px-6 py-3 text-sm font-semibold text-[#0B0B0A] disabled:opacity-40">{address?"Create draft charter":"Connect wallet to create charter"}</button></div>
    </form>
  </div>;
}
