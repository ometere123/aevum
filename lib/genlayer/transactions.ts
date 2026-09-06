import { env } from "../config";
import { createClient } from "genlayer-js";
export type TxStage="AWAITING_SIGNATURE"|"SUBMITTED"|"CONSENSUS"|"ACCEPTED/FINALIZED"|"EXECUTION_CONFIRMED"|"USER_REJECTED"|"WRONG_NETWORK"|"CONTRACT_ERROR"|"CONSENSUS_FAILURE"|"EXECUTION_ERROR"|"RPC_UNAVAILABLE";
export type TxState={stage:TxStage; hash?:string; error?:string};
export const explorerTx=(hash:string)=>`${env.explorer}/tx/${hash}`;
export async function confirmWrite(client: ReturnType<typeof createClient>, hash: `0x${string}`, reread: ()=>Promise<void>): Promise<TxState>{
  try {
    const receipt = await client.waitForTransactionReceipt({hash});
    const resultName = String((receipt as {resultName?: string}).resultName ?? "").toUpperCase();
    const statusName = String((receipt as {statusName?: string}).statusName ?? "").toUpperCase();
    if (resultName.includes("FAIL") || resultName.includes("ERROR") || statusName.includes("FAIL")) return {stage:"EXECUTION_ERROR",hash,error:resultName || statusName};
    await reread();
    return {stage:"EXECUTION_CONFIRMED",hash};
  } catch (error) { return {stage:"RPC_UNAVAILABLE",hash,error:error instanceof Error?error.message:"Unable to confirm transaction"}; }
}
