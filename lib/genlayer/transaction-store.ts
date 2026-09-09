export type StoredTransaction = {
  actionKey: string;
  account: string;
  chainId: string;
  contract: string;
  method: string;
  argsFingerprint: string;
  hash: string;
  submittedAt: number;
  stage: string;
  route?: string;
  organizationId?: string;
  finalResult?: string;
  error?: string;
  explorerUrl?: string;
  childHash?: string;
  childRecipient?: string;
  childValueWei?: string;
};

const KEY = "aevum:transactions";
export const TRANSACTION_EVENT = "aevum:transactions-changed";
const read = (): StoredTransaction[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as StoredTransaction[]; } catch { return []; }
};
import { stableJson } from "./serialization";

const write = (items: StoredTransaction[]) => { if (typeof window !== "undefined") { localStorage.setItem(KEY, stableJson(items)); window.dispatchEvent(new Event(TRANSACTION_EVENT)); } };
const fingerprint = (args: unknown[]) => stableJson(args);

export function rememberSubmittedTransaction(input: Omit<StoredTransaction, "argsFingerprint" | "submittedAt" | "stage"> & { args: unknown[] }) {
  const item: StoredTransaction = { ...input, argsFingerprint: fingerprint(input.args), submittedAt: Date.now(), stage: "SUBMITTED" };
  write([item, ...read().filter((existing) => existing.actionKey !== item.actionKey || existing.account.toLowerCase() !== item.account.toLowerCase())]);
  return item;
}

export function updateStoredTransaction(actionKey: string, account: string, stage: string) {
  write(read().map((item) => item.actionKey === actionKey && item.account.toLowerCase() === account.toLowerCase() ? { ...item, stage, finalResult: stage } : item));
}

export function allStoredTransactions(): StoredTransaction[] { return read(); }

export function pendingTransactions(account: string, chainId: string) {
  return read().filter((item) => item.account.toLowerCase() === account.toLowerCase() && item.chainId.toLowerCase() === chainId.toLowerCase() && ["SUBMITTED", "ACCEPTED", "CONSENSUS", "FINALIZED"].includes(item.stage));
}
