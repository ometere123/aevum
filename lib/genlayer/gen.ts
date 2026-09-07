import { formatEther, parseEther } from "viem";

export function parseGen(value:string):bigint{
  const normalized=value.trim();
  if(!/^\d+(?:\.\d{1,18})?$/.test(normalized)) throw new Error("Enter a valid GEN amount with at most 18 decimals.");
  const wei=parseEther(normalized);
  if(wei<=0n) throw new Error("GEN amount must be positive.");
  return wei;
}

export function formatGen(value:bigint|string|number|undefined):string{
  if(value===undefined) return "—";
  return formatEther(BigInt(value));
}
