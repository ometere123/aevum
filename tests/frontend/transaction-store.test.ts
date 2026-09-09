import { beforeEach, describe, expect, it } from "vitest";
import { allStoredTransactions, pendingTransactions, rememberSubmittedTransaction, updateStoredTransaction } from "../../lib/genlayer/transaction-store";

describe("account-scoped transaction persistence", () => {
  beforeEach(() => localStorage.clear());
  const base = { contract: "0x1111111111111111111111111111111111111111", method: "deposit", args: [9007199254740993001n], hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };

  it("serializes large bigint arguments exactly and retains the hash", () => {
    rememberSubmittedTransaction({ ...base, actionKey: "vault:1:deposit", account: "0xAa00000000000000000000000000000000000001", chainId: "0xf22f" });
    const record = allStoredTransactions()[0];
    expect(record.argsFingerprint).toContain("9007199254740993001");
    expect(record.hash).toBe(base.hash);
  });

  it("keeps wallet records isolated and updates the same wallet's lifecycle", () => {
    rememberSubmittedTransaction({ ...base, actionKey: "vault:1:deposit", account: "0xAa00000000000000000000000000000000000001", chainId: "0xf22f" });
    rememberSubmittedTransaction({ ...base, actionKey: "vault:1:deposit", account: "0xBb00000000000000000000000000000000000002", chainId: "0xf22f", hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" });
    updateStoredTransaction("vault:1:deposit", "0xAa00000000000000000000000000000000000001", "STATE_CONFIRMED");
    expect(pendingTransactions("0xAa00000000000000000000000000000000000001", "0xf22f")).toHaveLength(0);
    expect(pendingTransactions("0xBb00000000000000000000000000000000000002", "0xf22f")).toHaveLength(1);
  });
});
