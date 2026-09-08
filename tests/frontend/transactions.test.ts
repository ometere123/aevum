import {describe,expect,it,vi} from "vitest";
import {classifyWalletError,confirmWrite} from "../../lib/genlayer/transactions";

const hash="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;
function client(receipt:unknown){return {waitForFinalization:vi.fn().mockResolvedValue(receipt)} as never}

describe("finalized write confirmation",()=>{
  it("requires finalized status and rereads only after execution success",async()=>{
    const reread=vi.fn().mockResolvedValue(undefined);
    const result=await confirmWrite(client({statusName:"FINALIZED",txExecutionResultName:"SUCCESS"}),hash,reread);
    expect(result.stage).toBe("EXECUTION_CONFIRMED");expect(result.hash).toBe(hash);expect(reread).toHaveBeenCalledOnce();
  });
  it("does not claim success for execution failure",async()=>{
    const reread=vi.fn();const result=await confirmWrite(client({statusName:"FINALIZED",txExecutionResultName:"REVERTED"}),hash,reread);
    expect(result.stage).toBe("EXECUTION_ERROR");expect(reread).not.toHaveBeenCalled();
  });
  it("does not claim success for non-final consensus state",async()=>{
    const reread=vi.fn();const result=await confirmWrite(client({statusName:"ACCEPTED",txExecutionResultName:"SUCCESS"}),hash,reread);
    expect(result.stage).toBe("CONSENSUS_FAILURE");expect(reread).not.toHaveBeenCalled();
  });
  it("reads nested Studionet txExecutionResult receipts",async()=>{
    const reread=vi.fn().mockResolvedValue(undefined);
    const result=await confirmWrite(client({statusName:"FINALIZED",txExecutionResult:{name:"SUCCESS"}}),hash,reread);
    expect(result.stage).toBe("EXECUTION_CONFIRMED");
    expect(reread).toHaveBeenCalledOnce();
  });
  it("preserves a hash and distinguishes protocol undetermined",async()=>{
    const result=await confirmWrite(client({statusName:"UNDETERMINED",txExecutionResult:{name:"UNDETERMINED"}}),hash,vi.fn());
    expect(result.stage).toBe("CONSENSUS_UNDETERMINED");
    expect(result.hash).toBe(hash);
  });
  it("preserves hash when RPC finality polling fails",async()=>{
    const failing={waitForFinalization:vi.fn().mockRejectedValue(new Error("rpc down"))} as never;
    const result=await confirmWrite(failing,hash,async()=>{});expect(result.stage).toBe("RPC_UNAVAILABLE");expect(result.hash).toBe(hash);
  });
  it("classifies timeouts separately",async()=>{
    const failing={waitForFinalization:vi.fn().mockRejectedValue(new Error("finality timeout"))} as never;
    const result=await confirmWrite(failing,hash,async()=>{});expect(result.stage).toBe("FINALITY_TIMEOUT");expect(result.hash).toBe(hash);
  });
  it("reports canonical reread transport failure instead of success",async()=>{
    const result=await confirmWrite(client({statusName:"FINALIZED",txExecutionResultName:"SUCCESS"}),hash,async()=>{throw new Error("readback unavailable")});
    expect(result.stage).toBe("READBACK_ERROR");expect(result.hash).toBe(hash);
  });
  it("preserves canonical state mismatches as their own failure class",async()=>{
    const result=await confirmWrite(client({statusName:"FINALIZED",txExecutionResultName:"SUCCESS"}),hash,async()=>{throw new Error("STATE_MISMATCH: balance changed by the wrong amount")});
    expect(result.stage).toBe("STATE_MISMATCH");expect(result.hash).toBe(hash);
  });
});

describe("wallet error classification",()=>{
  it("classifies provider rejection",()=>{expect(classifyWalletError({code:4001}).stage).toBe("USER_REJECTED")});
  it("classifies explicit wrong-network errors",()=>{expect(classifyWalletError(new Error("WRONG_NETWORK: switch chain")).stage).toBe("WRONG_NETWORK")});
  it("keeps ordinary write failures as contract errors",()=>{expect(classifyWalletError(new Error("execution reverted")).stage).toBe("CONTRACT_ERROR")});
});
