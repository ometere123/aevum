import { env } from "../config";
import { createClient } from "genlayer-js";

export type TxStage=
  |"AWAITING_SIGNATURE"
  |"SUBMITTED"
  |"CONSENSUS"
  |"ACCEPTED/FINALIZED"
  |"EXECUTION_CONFIRMED"
  |"USER_REJECTED"
  |"WRONG_NETWORK"
  |"CONTRACT_ERROR"
  |"CONSENSUS_FAILURE"
  |"EXECUTION_ERROR"
  |"RPC_UNAVAILABLE"
  |"FINALITY_TIMEOUT"
  |"READBACK_ERROR"
  |"STATE_MISMATCH";

export type TxState={stage:TxStage;hash?:string;error?:string};
export const explorerTx=(hash:string)=>`${env.explorer}/tx/${hash}`;

export function classifyWalletError(error:unknown):TxState{
  const code=(error as {code?:number})?.code;
  const message=error instanceof Error?error.message:String(error??"");
  if(code===4001||/user rejected|user denied/i.test(message)) return {stage:"USER_REJECTED",error:message||"Wallet signature rejected"};
  if(/wrong_network|chain|network/i.test(message)) return {stage:"WRONG_NETWORK",error:message};
  return {stage:"CONTRACT_ERROR",error:message||"Contract write failed"};
}

export async function confirmWrite(
  client: ReturnType<typeof createClient>,
  hash: `0x${string}`,
  reread: ()=>Promise<void>,
): Promise<TxState>{
  let receipt:unknown;
  try{
    const finalizer=(client as unknown as {waitForFinalization?: (args:{hash:`0x${string}`})=>Promise<unknown>}).waitForFinalization;
    receipt=finalizer?await finalizer({hash}):await client.waitForTransactionReceipt({hash,waitUntil:"finalized"} as never);
  }catch(error){
    const message=error instanceof Error?error.message:"Unable to confirm transaction";
    return {stage:/timeout/i.test(message)?"FINALITY_TIMEOUT":"RPC_UNAVAILABLE",hash,error:message};
  }

  const item=receipt as {statusName?:string;txExecutionResultName?:string;resultName?:string;status?:string};
  const resultName=String(item.txExecutionResultName??item.resultName??"").toUpperCase();
  const statusName=String(item.statusName??item.status??"").toUpperCase();
  const successful=(client as unknown as {isSuccessful?: (receipt:unknown)=>boolean}).isSuccessful;

  if(statusName!=="FINALIZED") return {stage:"CONSENSUS_FAILURE",hash,error:`Transaction did not finalize: ${statusName||"unknown status"}`};
  if(successful&& !successful(receipt)) return {stage:"EXECUTION_ERROR",hash,error:"Authoritative SDK success check failed"};
  if(!successful&&resultName!=="SUCCESS") return {stage:"EXECUTION_ERROR",hash,error:resultName||"unknown execution result"};

  try{
    await reread();
  }catch(error){
    return {stage:"READBACK_ERROR",hash,error:error instanceof Error?error.message:"Canonical state reread failed"};
  }
  return {stage:"EXECUTION_CONFIRMED",hash};
}
