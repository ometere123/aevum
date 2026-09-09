"use client";

import { useEffect, useState } from "react";
import { explorerTx } from "../lib/genlayer/transactions";
import { allStoredTransactions, TRANSACTION_EVENT, type StoredTransaction } from "../lib/genlayer/transaction-store";
import { useWallet } from "../lib/genlayer/wallet";

export function TransactionHistory() {
  const { address, chainId } = useWallet();
  const [items, setItems] = useState<StoredTransaction[]>([]);
  useEffect(() => {
    const refresh = () => setItems(!address || chainId?.toLowerCase() !== "0xf22f" ? [] : allStoredTransactions().filter((item) => item.account.toLowerCase() === address.toLowerCase() && item.chainId.toLowerCase() === "0xf22f").slice(0, 5));
    refresh();
    window.addEventListener(TRANSACTION_EVENT, refresh);
    return () => window.removeEventListener(TRANSACTION_EVENT, refresh);
  }, [address, chainId]);
  if (!items.length) return null;
  return <aside aria-label="Recent wallet transactions" className="fixed bottom-4 right-4 z-30 w-[min(20rem,calc(100vw-2rem))] border border-[#E9E1CF44] bg-[#0B0B0Aee] p-4 shadow-[4px_4px_0_#B8784E]">
    <p className="mono text-[10px] tracking-[.2em] text-[#777269]">RECENT TRANSACTIONS</p>
    <div className="mt-3 space-y-3">
      {items.map((item) => <div key={`${item.actionKey}:${item.hash}`} className="border-t border-[#E9E1CF22] pt-2">
        <div className="flex items-center justify-between gap-3"><span className="mono text-[10px] text-[#B8FF5A]">{item.stage}</span><a className="mono text-[10px] underline" href={item.explorerUrl ?? explorerTx(item.hash)} target="_blank" rel="noreferrer">Explorer ↗</a></div>
        <p className="mono mt-1 truncate text-[10px] text-[#E9E1CF99]" title={item.hash}>{item.organizationId ?? item.actionKey.split(":")[1] ?? "—"} · {item.method} · {new Date(item.submittedAt).toLocaleString()}</p>
        <p className="mono mt-1 truncate text-[10px] text-[#E9E1CF99]" title={item.hash}>{item.hash}</p>
        {item.amountWei && <p className="mono mt-1 text-[10px] text-[#E9E1CF99]">{item.amountGen ?? "—"} GEN / {item.amountWei} wei</p>}
        {item.error && <p className="mt-1 break-words text-[10px] text-[#B8784E]">{item.error}</p>}
        {item.childHash&&<a className="mono mt-1 block truncate text-[10px] underline" href={explorerTx(item.childHash)} target="_blank" rel="noreferrer">Child transfer ↗ {item.childValueWei ?? ""} wei</a>}
      </div>)}
    </div>
  </aside>;
}
