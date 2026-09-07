"use client";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {useWallet} from "../../../../lib/genlayer/wallet";
import {confirmWrite} from "../../../../lib/genlayer/transactions";
import {env,assertConfigured} from "../../../../lib/config";
import {readAllowance,readOrganization,readVault} from "../../../../lib/genlayer/reads";
import {VaultActions} from "../../../../components/protocol-actions";
export default function Treasury(){
  const id=usePathname().split("/")[2]; const {address,writeClient,chainOk}=useWallet();
  const [org,setOrg]=useState<Record<string,any>>(); const [vault,setVault]=useState<Record<string,any>>(); const [allowance,setAllowance]=useState<number>(); const [state,setState]=useState("READING CORE / VAULT"); const [busy,setBusy]=useState(false);
  const reread=async()=>{const [o,v,a]=await Promise.all([readOrganization(id),readVault(id),readAllowance(id)]);setOrg(o);setVault(v);setAllowance(a);setState("CANONICAL READ")};
  useEffect(()=>{reread().catch(e=>setState(e instanceof Error?e.message:"RPC_FAILURE"))},[id]);
  const deposit=async()=>{if(busy)return;try{assertConfigured();if(!chainOk)throw new Error("WRONG_NETWORK: switch wallet to Studionet 61999");if(!address||!writeClient)throw new Error("Connect a wallet before signing.");setBusy(true);setState("AWAITING_SIGNATURE");await writeClient.connect("studionet");const hash=await writeClient.writeContract({address:env.vaultAddress as `0x${string}`,functionName:"deposit",args:[BigInt(id)],value:1000000000000000n});setState(`CONSENSUS ${hash}`);const final=await confirmWrite(writeClient,hash,reread);setState(final.hash?`${final.stage} ${final.hash}`:final.stage)}catch(e){setState(e instanceof Error?e.message:"CONTRACT_ERROR")}finally{setBusy(false)}};
  const metrics=[ ["FUNDED",vault?.funded??"—"], ["RELEASED",vault?.released??"—"], ["BALANCE",vault?.balance??"—"], ["ALLOWANCE",allowance??"—"] ];
  return <div className="mx-auto min-h-screen max-w-5xl px-6 pb-24 pt-36"><p className="mono text-xs tracking-[.3em] text-[#B8FF5A]">FOLIO 04 / TREASURY / {id}</p><h1 className="serif mt-4 text-6xl">Authority follows the charter.</h1><div className="mt-12 grid gap-4 md:grid-cols-4">{metrics.map(([key,value])=><div key={String(key)} className="border border-[#E9E1CF22] p-6"><p className="mono text-[10px] text-[#777269]">{String(key)} / WEI</p><p className="serif mt-4 text-3xl">{String(value)}</p></div>)}</div><div className="mt-5 border border-[#E9E1CF22] p-7"><p className="mono text-[10px] text-[#777269]">CORE AUTHORITY</p><p className="mt-3 text-sm">Status: {String(org?.status??"—")} / steward: {String(org?.current_steward??"—")} / spending: {String(org?.spending_enabled??"—")}</p><button disabled={busy} onClick={deposit} className="mt-8 rounded-full bg-[#B8FF5A] px-5 py-3 text-xs font-semibold text-[#0B0B0A] disabled:opacity-40">Deposit 0.001 GEN</button><VaultActions orgId={id}/><p className="mono mt-4 break-words text-[10px] text-[#B8784E]">{state}</p></div></div>
}
