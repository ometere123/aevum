"use client";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {readAllowance,readBindings,readCanRecoverTreasury,readOrganization,readVault} from "../../../../lib/genlayer/reads";
import {formatGen} from "../../../../lib/genlayer/gen";
import {VaultActions} from "../../../../components/protocol-actions";

type CanonicalRecord=Record<string,unknown>;

export default function Treasury(){
  const id=usePathname().split("/")[2];
  const [org,setOrg]=useState<CanonicalRecord>();const [vault,setVault]=useState<CanonicalRecord>();const [allowance,setAllowance]=useState<bigint>();const [canRecover,setCanRecover]=useState(false);const [binding,setBinding]=useState<{coreVault:string,vaultCore:string}>();const [state,setState]=useState("READING CORE / VAULT");
  const reread=async()=>{const [o,v,a,r,b]=await Promise.all([readOrganization(id),readVault(id),readAllowance(id),readCanRecoverTreasury(id),readBindings()]);setOrg(o);setVault(v);setAllowance(a);setCanRecover(r);setBinding(b);setState("CANONICAL READ")};
  useEffect(()=>{queueMicrotask(()=>{void reread().catch(e=>setState(e instanceof Error?e.message:"RPC_FAILURE"))})},[id]);
  const metrics:[string,unknown][]=[
    ["FUNDED",vault?.funded],
    ["RELEASED",vault?.released],
    ["RECOVERED",vault?.recovered],
    ["BALANCE",vault?.balance],
    ["EPOCH ALLOWANCE",allowance],
  ];
  return <div className="mx-auto min-h-screen max-w-5xl px-6 pb-24 pt-36">
    <p className="mono text-xs tracking-[.3em] text-[#B8FF5A]">FOLIO 04 / TREASURY / {id}</p><h1 className="serif mt-4 text-6xl">Authority follows the charter.</h1>
    <div className="mt-12 grid gap-4 md:grid-cols-5">{metrics.map(([key,value])=><div key={key} className="border border-[#E9E1CF22] p-5"><p className="mono text-[10px] text-[#777269]">{key}</p><p className="serif mt-4 break-words text-2xl">{value===undefined?"—":`${formatGen(value as string|number|bigint)} GEN`}</p><p className="mono mt-2 break-all text-[9px] text-[#777269]">{value===undefined?"":`${String(value)} wei`}</p></div>)}</div>
    <div className="mt-5 border border-[#E9E1CF22] p-7"><p className="mono text-[10px] text-[#777269]">CORE AUTHORITY</p><p className="mt-3 text-sm">Status: {String(org?.status??"—")} / steward: <span className="break-all">{String(org?.current_steward??"—")}</span> / spending: {String(org?.spending_enabled??"—")}</p><p className="mono mt-3 break-all text-[9px] text-[#777269]">Core→Vault {binding?.coreVault??"—"}<br/>Vault→Core {binding?.vaultCore??"—"}</p><p className="mono mt-2 text-[9px] text-[#B8784E]">Dormant recovery eligible: {String(canRecover)}</p><VaultActions orgId={id} onChanged={reread} canDeposit={org?.status==="ACTIVE"&&org?.sealed===true} canRelease={org?.status==="ACTIVE"&&org?.spending_enabled===true}/><p className="mono mt-4 break-words text-[10px] text-[#B8784E]">{state}</p></div>
  </div>;
}
