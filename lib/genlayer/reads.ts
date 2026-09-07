import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { env, assertConfigured } from "../config";

const client=createClient({chain:studionet});
const core=()=>env.coreAddress as `0x${string}`;
const vault=()=>env.vaultAddress as `0x${string}`;
async function read(address:`0x${string}`,functionName:string,args:unknown[]=[]){
  assertConfigured();
  return client.readContract({address,functionName,args,transactionHashVariant:"latest-final"} as never) as Promise<unknown>;
}
const json=(value:unknown)=>JSON.parse(String(value));
export async function readOrganization(id:string){return json(await read(core(),"get_organization",[BigInt(id)]));}
export async function readOrganizations(){
  const count=Number(await read(core(),"get_organization_count"));
  return Promise.all(Array.from({length:count},(_,i)=>readOrganization(String(i+1))));
}
export async function readSources(id:string, count:number){return Promise.all(Array.from({length:count},(_,i)=>read(core(),"get_source",[BigInt(id),BigInt(i+1)]).then(json)));}
export async function readReview(id:string){return json(await read(core(),"get_review",[BigInt(id)]));}
export async function readVault(id:string){return json(await read(vault(),"get_vault",[BigInt(id)]));}
export async function readAllowance(id:string){return Number(await read(vault(),"remaining_epoch_allowance",[BigInt(id)]));}
