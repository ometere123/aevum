import { env } from "../config";
import { createClient } from "genlayer-js";
export type TxStage="AWAITING_SIGNATURE"|"SUBMITTED"|"CONSENSUS"|"ACCEPTED/FINALIZED"|"EXECUTION_CONFIRMED"|"USER_REJECTED"|"WRONG_NETWORK"|"CONTRACT_ERROR"|"CONSENSUS_FAILURE"|"EXECUTION_ERROR"|"RPC_UNAVAILABLE";
export type TxState={stage:TxStage; hash?:string; error?:string};
export const explorerTx=(hash:string)=>`${env.explorer}/tx/${hash}`;
export async function confirmWrite(client: ReturnType<typeof createClient>, hash: `0x${string}`, reread: ()=>Promise<void>): Promise<TxState>{
  try {
    const finalizer = (client as unknown as {waitForFinalization?: (args:{hash:`0x${string}`})=>Promise<unknown>}).waitForFinalization;
    const receipt = finalizer ? await finalizer({hash}) : await client.waitForTransactionReceipt({hash, waitUntil:"finalized"} as never);
    const item=receipt as {statusName?:string;txExecutionResultName?:string;resultName?:string;status?:string};
    const resultName=String(item.txExecutionResultName ?? item.resultName ?? "").toUpperCase();
    const statusName=String(item.statusName ?? item.status ?? "").toUpperCase();
    const successful = (client as unknown as {isSuccessful?: (receipt: unknown)=>boolean}).isSuccessful;
    if (successful && !successful(receipt)) return {stage:"EXECUTION_ERROR",hash,error:"Authoritative SDK success check failed"};
    if (statusName !== "FINALIZED") return {stage:"CONSENSUS_FAILURE",hash,error:`Transaction did not finalize: ${statusName || "unknown status"}`};
    if (!successful && resultName !== "SUCCESS") return {stage:"EXECUTION_ERROR",hash,error:resultName || "unknown execution result"};
    await reread();
    return {stage:"EXECUTION_CONFIRMED",hash};
  } catch (error) { return {stage:"RPC_UNAVAILABLE",hash,error:error instanceof Error?error.message:"Unable to confirm transaction"}; }
}
