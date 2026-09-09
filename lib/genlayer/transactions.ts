import { env } from "../config";
import { createClient } from "genlayer-js";
import { executionResultNumberToName, transactionsStatusNumberToName } from "genlayer-js/types";
import { toJsonSafe, stableJson } from "./serialization";
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
  |"STATE_MISMATCH"
  |"OUTCOME_UNKNOWN";

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

function receiptValueName(value: unknown, map: Record<string, string>): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return map[String(value)] ?? String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["name", "statusName", "resultName", "executionResultName", "txExecutionResultName"]) {
      const named = record[key];
      if (typeof named === "string" && named) return named;
      if (typeof named === "number" || typeof named === "bigint") return map[String(named)] ?? String(named);
    }
  }
  return "";
}

function nestedReceiptName(receipt: unknown, keys: string[], map: Record<string, string>): string {
  if (!receipt || typeof receipt !== "object") return "";
  const record = receipt as Record<string, unknown>;
  for (const key of keys) {
    const named = receiptValueName(record[key], map);
    if (named) return named;
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const nested = nestedReceiptName(value, keys, map);
      if (nested) return nested;
    }
  }
  return "";
}

function safeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  try { return stableJson(toJsonSafe(error)); } catch { return "Unknown transaction outcome"; }
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
    const message=safeError(error) || "Unable to confirm transaction";
    return {stage:/timeout/i.test(message)?"FINALITY_TIMEOUT":"RPC_UNAVAILABLE",hash,error:message};
  }

  // Studionet receipts may contain numeric/bigint enum fields, including nested
  // leader receipts. Normalize only for inspection/display; never mutate SDK data.
  const resultName=(nestedReceiptName(receipt,["txExecutionResultName","txExecutionResult","executionResultName","execution_result"],executionResultNumberToName)||nestedReceiptText(receipt,["resultName","result","name"])).toUpperCase();
  const statusName=(nestedReceiptName(receipt,["statusName","status","decision","consensusStatus"],transactionsStatusNumberToName)||nestedReceiptText(receipt,["statusName","status","decision","consensusStatus"])).toUpperCase();
  const successful=(client as unknown as {isSuccessful?: (receipt:unknown)=>boolean}).isSuccessful;

  if(statusName.includes("UNDETERMINED")||resultName.includes("UNDETERMINED")) return {stage:"CONSENSUS_UNDETERMINED",hash,error:"Validators could not reach majority. This transaction was not executed."};
  if(statusName!=="FINALIZED") return {stage:"CONSENSUS_FAILURE",hash,error:`Transaction did not finalize: ${statusName||"unknown status"}`};
  if(successful&& !successful(receipt)) return {stage:"EXECUTION_ERROR",hash,error:"Authoritative SDK success check failed"};
  if(!successful&&!["SUCCESS","FINISHED_WITH_RETURN"].includes(resultName)) return {stage:"EXECUTION_ERROR",hash,error:resultName||"unknown execution result"};

  try{
    await reread();
  }catch(error){
    const message=safeError(error) || "Canonical state reread failed";
    return {stage:/^STATE_MISMATCH:/i.test(message)?"STATE_MISMATCH":"READBACK_ERROR",hash,error:`Outcome unknown after finalization: canonical state verification is unavailable: ${message}`};
  }
  return {stage:"EXECUTION_CONFIRMED",hash};
}
