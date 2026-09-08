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
};

const KEY = "aevum:transactions";
const read = (): StoredTransaction[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as StoredTransaction[]; } catch { return []; }
};
const write = (items: StoredTransaction[]) => { if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(items)); };
const fingerprint = (args: unknown[]) => JSON.stringify(args, (_, value) => typeof value === "bigint" ? `${value}n` : value);

export function rememberSubmittedTransaction(input: Omit<StoredTransaction, "argsFingerprint" | "submittedAt" | "stage"> & { args: unknown[] }) {
  const item: StoredTransaction = { ...input, argsFingerprint: fingerprint(input.args), submittedAt: Date.now(), stage: "SUBMITTED" };
  write([item, ...read().filter((existing) => existing.actionKey !== item.actionKey || existing.account.toLowerCase() !== item.account.toLowerCase())]);
  return item;
}

export function updateStoredTransaction(actionKey: string, account: string, stage: string) {
  write(read().map((item) => item.actionKey === actionKey && item.account.toLowerCase() === account.toLowerCase() ? { ...item, stage } : item));
}

export function pendingTransactions(account: string, chainId: string) {
  return read().filter((item) => item.account.toLowerCase() === account.toLowerCase() && item.chainId.toLowerCase() === chainId.toLowerCase() && ["SUBMITTED", "CONSENSUS", "FINALIZED"].includes(item.stage));
}
