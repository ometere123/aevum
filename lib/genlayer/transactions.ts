import { env } from "../config";
import { createClient } from "genlayer-js";
export { stableJson, toJsonSafe, normalizeSdkValue, writeContractSafely } from "./serialization";

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
  |"CONSENSUS_UNDETERMINED"
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
  if(/wrong_network|wrong network|switch wallet|chain mismatch/i.test(message)) return {stage:"WRONG_NETWORK",error:message};
  return {stage:"CONTRACT_ERROR",error:message||"Contract write failed"};
}

function nestedReceiptText(receipt:unknown, keys:string[]):string{
  if(!receipt||typeof receipt!=="object") return "";
  const record=receipt as Record<string,unknown>;
  for(const key of keys){
    const value=record[key];
    if(typeof value==="string"&&value) return value;
    if(value&&typeof value==="object"){
      const nested=nestedReceiptText(value,keys);
      if(nested) return nested;
    }
  }
  for(const value of Object.values(record)){
    if(value&&typeof value==="object"){
      const nested=nestedReceiptText(value,keys);
      if(nested) return nested;
    }
  }
  return "";
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

  const resultName=nestedReceiptText(receipt,["txExecutionResultName","executionResultName","resultName","execution_result","result","name"]).toUpperCase();
  const statusName=nestedReceiptText(receipt,["statusName","status","decision","consensusStatus"]).toUpperCase();
  const successful=(client as unknown as {isSuccessful?: (receipt:unknown)=>boolean}).isSuccessful;

  if(statusName.includes("UNDETERMINED")||resultName.includes("UNDETERMINED")) return {stage:"CONSENSUS_UNDETERMINED",hash,error:"Validators could not reach majority. This transaction was not executed."};
  if(statusName!=="FINALIZED") return {stage:"CONSENSUS_FAILURE",hash,error:`Transaction did not finalize: ${statusName||"unknown status"}`};
  if(successful&& !successful(receipt)) return {stage:"EXECUTION_ERROR",hash,error:"Authoritative SDK success check failed"};
  if(!successful&&resultName!=="SUCCESS") return {stage:"EXECUTION_ERROR",hash,error:resultName||"unknown execution result"};

  try{
    await reread();
  }catch(error){
    const message=error instanceof Error?error.message:"Canonical state reread failed";
    return {stage:/^STATE_MISMATCH:/i.test(message)?"STATE_MISMATCH":"READBACK_ERROR",hash,error:message};
  }
  return {stage:"EXECUTION_CONFIRMED",hash};
}
