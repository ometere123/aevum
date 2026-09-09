import { env } from "../config";
import { createClient } from "genlayer-js";
import { executionResultNumberToName, transactionResultNumberToName, transactionsStatusNumberToName } from "genlayer-js/types";
import { toJsonSafe, stableJson } from "./serialization";
export { stableJson, toJsonSafe, normalizeSdkValue, writeContractSafely } from "./serialization";

export type TxStage=
  |"AWAITING_SIGNATURE"
  |"SUBMITTED"
  |"ACCEPTED"
  |"CONSENSUS"
  |"FINALIZED"
  |"EXECUTION_CONFIRMED"
  |"STATE_CONFIRMED"
  |"RETRYABLE_ERROR"
  |"USER_REJECTED"
  |"WRONG_NETWORK"
  |"CONTRACT_ERROR"
  |"CONSENSUS_FAILURE"
  |"CONSENSUS_UNDETERMINED"
  |"EXECUTION_FAILED"
  |"EXECUTION_ERROR"
  |"RPC_UNAVAILABLE"
  |"FINALITY_TIMEOUT"
  |"READBACK_ERROR"
  |"STATE_MISMATCH"
  |"OUTCOME_UNKNOWN";

export type TxState={stage:TxStage;hash?:string;error?:string};
export const explorerTx=(hash:string)=>`${env.explorer}/tx/${hash}`;

export function normalizeWalletError(error: unknown): string {
  const code=(error as {code?:number})?.code;
  const message=error instanceof Error?error.message:String(error??"");
  if (code===4001 || /user rejected|user denied/i.test(message)) return "Wallet signature rejected.";
  if (/wrong_network|wrong network|chain mismatch|61999/i.test(message)) return "Switch your wallet to GenLayer Studionet (61999).";
  if (/4902|add.*chain|unsupported.*switch|method not found|-32601/i.test(message)) return "This wallet cannot switch networks automatically. Add GenLayer Studionet (61999) manually.";
  if (/rpc|fetch|network request|timeout|timed out/i.test(message)) return "Studionet RPC is temporarily unavailable.";
  return message.length>240 ? `${message.slice(0,237)}...` : message || "Contract write failed.";
}

export function classifyWalletError(error:unknown):TxState{
  const code=(error as {code?:number})?.code;
  const message=error instanceof Error?error.message:String(error??"");
  if(code===4001||/user rejected|user denied/i.test(message)) return {stage:"USER_REJECTED",error:"Wallet signature rejected."};
  if(/wrong_network|wrong network|switch wallet|chain mismatch/i.test(message)) return {stage:"WRONG_NETWORK",error:"Switch your wallet to GenLayer Studionet (61999)."};
  return {stage:"CONTRACT_ERROR",error:normalizeWalletError(error)};
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

function receiptNames(receipt: unknown, keys: string[], map?: Record<string, string>): string[] {
  const wanted = new Set(keys);
  const found: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    for (const [key, item] of Object.entries(record)) {
      if (wanted.has(key)) {
        const name = map ? receiptValueName(item, map) : receiptValueName(item, {});
        if (name) found.push(name.toUpperCase());
      }
      if (item && typeof item === "object") visit(item);
    }
  };
  visit(receipt);
  return [...new Set(found)];
}

function safeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  try { return stableJson(toJsonSafe(error)); } catch { return "Unknown transaction outcome"; }
}

export async function confirmWrite(
  client: ReturnType<typeof createClient>,
  hash: `0x${string}`,
  reread: ()=>Promise<void>,
  options: { timeoutMs?: number } = {},
): Promise<TxState>{
  let receipt:unknown;
  try{
    const finalizer=(client as unknown as {waitForFinalization?: (args:{hash:`0x${string}`})=>Promise<unknown>}).waitForFinalization;
    const polling=finalizer?finalizer({hash}):client.waitForTransactionReceipt({hash,waitUntil:"finalized"} as never);
    const timeoutMs=options.timeoutMs??120_000;
    receipt=await Promise.race([polling,new Promise((_,reject)=>setTimeout(()=>reject(new Error("finality timeout")),timeoutMs))]);
  }catch(error){
    const rawMessage=safeError(error) || "Unable to confirm transaction";
    const message=normalizeWalletError(error) || "Unable to confirm transaction";
    return {stage:/timeout/i.test(rawMessage)?"FINALITY_TIMEOUT":"RPC_UNAVAILABLE",hash,error:`Outcome unknown: ${message}`};
  }

  // Studionet receipts may contain numeric/bigint enum fields, including nested
  // leader receipts. Normalize only for inspection/display; never mutate SDK data.
  // Studionet exposes three independent dimensions. `statusName` is protocol
  // finality, `resultName` is consensus, and `txExecutionResultName` is GenVM
  // execution. Do not use a generic `name` or treat consensus ACCEPTED as
  // protocol FINALIZED.
  const statusNames=receiptNames(receipt,["statusName","status","protocolStatus","finalityStatus","txStatus"],transactionsStatusNumberToName);
  const consensusNames=receiptNames(receipt,["resultName","result","consensusResult","consensus_result"],transactionResultNumberToName);
  const executionNames=receiptNames(receipt,["txExecutionResultName","txExecutionResult","executionResultName","execution_result","executionResult"],executionResultNumberToName);
  const statusName=statusNames[0]??"";
  const consensusName=consensusNames[0]??"";
  const resultName=executionNames[0]??"";
  const successful=(client as unknown as {isSuccessful?: (receipt:unknown)=>boolean}).isSuccessful;

  if(statusName.includes("UNDETERMINED")||consensusName.includes("UNDETERMINED")||consensusName.includes("NO_MAJORITY")) return {stage:"CONSENSUS_UNDETERMINED",hash,error:"Validators could not reach majority. This transaction was not executed."};
  if(statusName!=="FINALIZED") {
    if(statusName==="ACCEPTED"||consensusName==="ACCEPTED"||consensusName==="MAJORITY_AGREE"||consensusName==="AGREE") return {stage:"ACCEPTED",hash,error:"Consensus accepted; awaiting protocol finality."};
    return {stage:"CONSENSUS_FAILURE",hash,error:`Transaction did not finalize: ${statusName||"unknown status"}`};
  }
  if(successful&& !successful(receipt)) return {stage:"EXECUTION_FAILED",hash,error:"Finalized transaction execution failed."};
  if(!successful&&!["SUCCESS","FINISHED_WITH_RETURN"].includes(resultName)) return {stage:"EXECUTION_FAILED",hash,error:resultName||"unknown execution result"};

  try{
    await reread();
  }catch(error){
    const message=safeError(error) || "Canonical state reread failed";
    return {stage:/^STATE_MISMATCH:/i.test(message)?"STATE_MISMATCH":"READBACK_ERROR",hash,error:`Outcome unknown after finalization: canonical state verification is unavailable: ${message}`};
  }
  return {stage:"STATE_CONFIRMED",hash};
}

export type TriggeredTransfer = { hash: string; recipient: string; value: bigint; execution?: string };

export async function findTriggeredTransfer(
  client: ReturnType<typeof createClient>,
  parentHash: `0x${string}`,
  expectedRecipient: string,
  expectedValue: bigint,
): Promise<TriggeredTransfer | undefined> {
  const ids=await client.getTriggeredTransactionIds({hash:parentHash as never});
  const getTransaction=(client as unknown as {getTransaction?: (args:{hash:string})=>Promise<unknown>}).getTransaction;
  if(!getTransaction) return undefined;
  for(const id of ids){
    const raw=await getTransaction({hash:id});
    if(!raw||typeof raw!=="object") continue;
    const tx=raw as Record<string,unknown>;
    const recipient=String(tx.recipient??tx.to??tx.to_address??"");
    const valueRaw=tx.value??tx.amount??tx.value_wei;
    if(!recipient||valueRaw===undefined) continue;
    let value:bigint;
    try { value=BigInt(String(valueRaw)); } catch { continue; }
    if(recipient.toLowerCase()===expectedRecipient.toLowerCase()&&value===expectedValue) return {hash:String(id),recipient,value,execution:String(tx.txExecutionResultName??tx.executionResultName??tx.statusName??"")};
  }
  return undefined;
}
