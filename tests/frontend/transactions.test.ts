import {describe,expect,it,vi} from "vitest";
import {classifyWalletError,confirmWrite,findTriggeredTransfer,normalizeWalletError} from "../../lib/genlayer/transactions";

const hash="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;
function client(receipt:unknown){return {waitForFinalization:vi.fn().mockResolvedValue(receipt)} as never}

describe("shared transaction lifecycle",()=>{
  it("requires finalized status and canonical reread after execution success",async()=>{
    const reread=vi.fn().mockResolvedValue(undefined);
    const result=await confirmWrite(client({statusName:"FINALIZED",txExecutionResultName:"SUCCESS"}),hash,reread);
    expect(result.stage).toBe("STATE_CONFIRMED");expect(result.hash).toBe(hash);expect(reread).toHaveBeenCalledOnce();
  });
  it("classifies finalized execution failure",async()=>{
    const reread=vi.fn();const result=await confirmWrite(client({statusName:"FINALIZED",txExecutionResultName:"REVERTED"}),hash,reread);
    expect(result.stage).toBe("EXECUTION_FAILED");expect(result.hash).toBe(hash);expect(reread).not.toHaveBeenCalled();
  });
  it("keeps accepted but not finalized transactions pending",async()=>{
    const result=await confirmWrite(client({statusName:"ACCEPTED",resultName:"Accepted",txExecutionResultName:"SUCCESS"}),hash,vi.fn());
    expect(result.stage).toBe("ACCEPTED");expect(result.hash).toBe(hash);
  });
  it("accepts the exact Studionet finalized/accepted/GenVM success shape",async()=>{
    const reread=vi.fn().mockResolvedValue(undefined);
    const receipt={statusName:"FINALIZED",resultName:"Accepted",txExecutionResultName:"SUCCESS",consensus_data:{final:true,leader_receipt:[{resultName:"Accepted",txExecutionResultName:"SUCCESS"}]}};
    const result=await confirmWrite(client(receipt),hash,reread);
    expect(result.stage).toBe("STATE_CONFIRMED");expect(result.hash).toBe(hash);expect(reread).toHaveBeenCalledOnce();
  });
  it("classifies finalized accepted rollback as execution failure",async()=>{
    const reread=vi.fn();const result=await confirmWrite(client({statusName:"FINALIZED",resultName:"Accepted",txExecutionResultName:"ROLLBACK"}),hash,reread);
    expect(result.stage).toBe("EXECUTION_FAILED");expect(result.hash).toBe(hash);expect(reread).not.toHaveBeenCalled();
  });
  it("reads numeric and bigint Studionet receipts",async()=>{
    const reread=vi.fn().mockResolvedValue(undefined);
    const receipt={status:7n,txExecutionResult:1n,leaderReceipt:{status:7n,txExecutionResult:1n,amount:90071992547409931234567890n}};
    const result=await confirmWrite(client(receipt),hash,reread);
    expect(result.stage).toBe("STATE_CONFIRMED");expect(reread).toHaveBeenCalledOnce();
  });
  it("preserves a hash for consensus undetermined",async()=>{
    const result=await confirmWrite(client({statusName:"UNDETERMINED",txExecutionResult:{name:"UNDETERMINED"}}),hash,vi.fn());
    expect(result.stage).toBe("CONSENSUS_UNDETERMINED");expect(result.hash).toBe(hash);
  });
  it("preserves a hash when polling fails or times out",async()=>{
    const failing={waitForFinalization:vi.fn().mockRejectedValue(new Error("rpc down"))} as never;
    const result=await confirmWrite(failing,hash,async()=>{});expect(result.stage).toBe("RPC_UNAVAILABLE");expect(result.hash).toBe(hash);
    const timeout=await confirmWrite({waitForFinalization:vi.fn().mockReturnValue(new Promise(()=>{}))} as never,hash,async()=>{},{timeoutMs:1});
    expect(timeout.stage).toBe("FINALITY_TIMEOUT");expect(timeout.hash).toBe(hash);
  });
  it("reports canonical reread failure and mismatch without losing the hash",async()=>{
    const failed=await confirmWrite(client({statusName:"FINALIZED",txExecutionResultName:"SUCCESS"}),hash,async()=>{throw new Error("readback unavailable")});
    expect(failed.stage).toBe("READBACK_ERROR");expect(failed.hash).toBe(hash);expect(failed.error).toContain("Outcome unknown");
    const mismatch=await confirmWrite(client({statusName:"FINALIZED",txExecutionResultName:"SUCCESS"}),hash,async()=>{throw new Error("STATE_MISMATCH: wrong delta")});
    expect(mismatch.stage).toBe("STATE_MISMATCH");expect(mismatch.hash).toBe(hash);
  });
  it("identifies a triggered native transfer by exact child recipient and value",async()=>{
    const child="0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const result=await findTriggeredTransfer({getTriggeredTransactionIds:vi.fn().mockResolvedValue([child]),getTransaction:vi.fn().mockResolvedValue({to:"0x2222222222222222222222222222222222222222",value:"1000000000000000",statusName:"FINALIZED"})} as never,hash,"0x2222222222222222222222222222222222222222",1000000000000000n);
    expect(result).toEqual({hash:child,recipient:"0x2222222222222222222222222222222222222222",value:1000000000000000n,execution:"FINALIZED"});
  });
});

describe("wallet error classification",()=>{
  it("classifies provider rejection",()=>{expect(classifyWalletError({code:4001}).stage).toBe("USER_REJECTED")});
  it("classifies explicit wrong-network errors",()=>{expect(classifyWalletError(new Error("WRONG_NETWORK: switch chain")).stage).toBe("WRONG_NETWORK")});
  it("keeps ordinary write failures as contract errors",()=>{expect(classifyWalletError(new Error("execution reverted")).stage).toBe("CONTRACT_ERROR")});
  it("normalizes provider errors without exposing raw metadata",()=>{expect(normalizeWalletError({code:4001,message:"wallet object with base64 icon"})).toBe("Wallet signature rejected.")});
});
