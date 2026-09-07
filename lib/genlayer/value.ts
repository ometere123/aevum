import { formatEther, keccak256, parseEther, stringToHex } from "viem";

export function parseGen(value: string): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(normalized)) throw new Error("Enter a valid GEN amount with at most 18 decimals.");
  const wei = parseEther(normalized);
  if (wei <= 0n) throw new Error("Amount must be greater than zero.");
  return wei;
}

export function formatGen(value: bigint | string | number): string {
  return formatEther(BigInt(value));
}

export function memoHash(orgId: string, recipient: string, amountWei: bigint, memo: string): `0x${string}` {
  const payload = JSON.stringify({ orgId, recipient: recipient.toLowerCase(), amountWei: amountWei.toString(), memo: memo.trim() });
  return keccak256(stringToHex(payload));
}
