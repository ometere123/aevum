import type { createClient } from "genlayer-js";

export type JsonSafe = null | boolean | number | string | JsonSafe[] | { [key: string]: JsonSafe };

/** Preserve exact protocol integers for the GenLayer calldata encoder. */
export function normalizeSdkValue<T>(value: T): T {
  if (typeof value === "bigint" || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => normalizeSdkValue(item)) as T;
  if (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeSdkValue(item)])) as T;
  }
  return value;
}

/** Convert values only for JSON/localStorage boundaries; bigint becomes exact decimal text. */
export function toJsonSafe(value: unknown): JsonSafe {
  if (typeof value === "bigint") return value.toString(10);
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)]));
  return String(value);
}

export function stableJson(value: unknown): string {
  return JSON.stringify(toJsonSafe(value));
}

export type ContractWrite = {
  address: `0x${string}`;
  functionName: string;
  args?: unknown[];
  value?: bigint | number;
  kwargs?: unknown;
};

/** One write boundary for every frontend contract action. */
export async function writeContractSafely(
  client: ReturnType<typeof createClient>,
  input: ContractWrite,
): Promise<`0x${string}`> {
  const args = normalizeSdkValue(input.args ?? []);
  // The SDK accepts bigint for payable values. Use numeric zero for the zero-value
  // case so injected providers never receive a needless JSON-unsafe zero bigint.
  const value = input.value === 0n ? 0 : (input.value ?? 0);
  return client.writeContract({ ...input, args: args as never, value, kwargs: input.kwargs as never } as never) as Promise<`0x${string}`>;
}
