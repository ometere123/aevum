import {describe,expect,it,vi} from "vitest";
import {confirmWrite} from "../../lib/genlayer/transactions";

const hash="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;
function client(receipt:unknown){return {waitForFinalization:vi.fn().mockResolvedValue(receipt)} as never}

describe("finalized write confirmation",()=>{
  it("requires finalized status and rereads only after execution success",async()=>{
    const reread=vi.fn().mockResolvedValue(undefined);
    const result=await confirmWrite(client({statusName:"FINALIZED",txExecutionResultName:"SUCCESS"}),hash,reread);
    expect(result.stage).toBe("EXECUTION_CONFIRMED"); expect(result.hash).toBe(hash); expect(reread).toHaveBeenCalledOnce();
  });
  it("does not claim success for consensus failure",async()=>{
    const reread=vi.fn(); const result=await confirmWrite(client({statusName:"FINALIZED",txExecutionResultName:"REVERTED"}),hash,reread);
    expect(result.stage).toBe("EXECUTION_ERROR"); expect(reread).not.toHaveBeenCalled();
  });
  it("preserves hash when RPC finality polling fails",async()=>{
    const failing={waitForFinalization:vi.fn().mockRejectedValue(new Error("rpc down"))} as never;
    const result=await confirmWrite(failing,hash,async()=>{}); expect(result.stage).toBe("RPC_UNAVAILABLE"); expect(result.hash).toBe(hash);
  });
});
