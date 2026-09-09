import { describe, expect, it, vi } from "vitest";
import { parseGen } from "../../lib/genlayer/gen";
import { normalizeSdkValue, stableJson, toJsonSafe, writeContractSafely } from "../../lib/genlayer/serialization";

const hash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;

describe("shared GenLayer write normalization", () => {
  it("preserves bigint arguments for the SDK and exact decimal persistence", () => {
    const value = { org: 90071992547409931234567890n, address: "0xca13", nested: [1n, "001"] };
    expect(normalizeSdkValue(value).org).toBe(90071992547409931234567890n);
    expect(toJsonSafe(value)).toEqual({ org: "90071992547409931234567890", address: "0xca13", nested: ["1", "001"] });
    expect(stableJson(value)).toContain("90071992547409931234567890");
  });

  it("keeps decimal GEN conversion exact at the SDK boundary", () => {
    expect(parseGen("1.000000000000000001")).toBe(1000000000000000001n);
  });

  it.each([
    "create_organization", "add_source", "seal_organization", "nominate_successor", "withdraw_nomination",
    "trigger_continuity_review", "recover_review", "close_organization", "deposit", "release", "recover_dormant",
  ])("prepares %s arguments without JSON BigInt serialization", async (functionName) => {
    const writeContract = vi.fn().mockResolvedValue(hash);
    const client = { writeContract } as never;
    const args = [7n, "0xca13", 1000000000000000001n];
    await writeContractSafely(client, { address: "0x1111111111111111111111111111111111111111", functionName, args, value: functionName === "deposit" ? 1000000000000000001n : 0n });
    expect(writeContract).toHaveBeenCalledOnce();
    const call = writeContract.mock.calls[0][0];
    expect(call.args).toEqual(args);
    expect(call.args[2]).toBe(1000000000000000001n);
    expect(() => JSON.stringify(toJsonSafe(call.args))).not.toThrow();
  });
});
