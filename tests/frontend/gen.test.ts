import {describe,expect,it} from "vitest";
import {formatGen,parseGen} from "../../lib/genlayer/gen";

describe("exact GEN conversion",()=>{
  it("converts decimal GEN without floating point",()=>{
    expect(parseGen("0.001")).toBe(1000000000000000n);
    expect(parseGen("1.000000000000000001")).toBe(1000000000000000001n);
  });
  it("rejects more than 18 decimals",()=>{expect(()=>parseGen("0.0000000000000000001")).toThrow(/18 decimals/)});
  it("formats wei back to GEN",()=>{expect(formatGen(125000000000000000n)).toBe("0.125")});
});
