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
export async function readSources(id:string,count:number){
  return Promise.all(Array.from({length:count},(_,i)=>read(core(),"get_source_by_index",[BigInt(id),BigInt(i)]).then(json)));
}
export async function readReview(id:string){return json(await read(core(),"get_review",[BigInt(id)]));}
export async function readCandidates(id:string,count:number){
  return Promise.all(Array.from({length:count},(_,i)=>read(core(),"get_candidate_by_index",[BigInt(id),BigInt(i)]).then(json)));
}
export async function readVault(id:string){return json(await read(vault(),"get_vault",[BigInt(id)]));}
export async function readAllowance(id:string){return BigInt(String(await read(vault(),"remaining_epoch_allowance",[BigInt(id)])));}
export async function readSpendingEnabled(id:string){return Boolean(await read(core(),"is_spending_enabled",[BigInt(id)]));}
export async function readReviewDue(id:string){return Boolean(await read(core(),"is_review_due",[BigInt(id)]));}
export async function readCanRecoverTreasury(id:string){return Boolean(await read(core(),"can_recover_treasury",[BigInt(id)]));}
export async function readRecoveryPolicy(id:string){return json(await read(core(),"get_recovery_policy",[BigInt(id)]));}
export async function readVaultBinding(){return String(await read(core(),"get_vault_address"));}
export async function readVaultCore(){return String(await read(vault(),"get_core_address"));}
export async function readReleaseUsed(id:string,memoHash:`0x${string}`){return Boolean(await read(vault(),"was_release_used",[BigInt(id),memoHash]));}
export async function readBindings(){const [coreVault,vaultCore]=await Promise.all([readVaultBinding(),readVaultCore()]);return {coreVault:coreVault.toLowerCase(),vaultCore:vaultCore.toLowerCase()};}
