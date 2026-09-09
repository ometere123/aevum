import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { useWallet, WalletProvider, type EIP1193Provider } from "../../lib/genlayer/wallet";

function Probe() {
  const wallet = useWallet();
  return createElement("div", null, createElement("span", { "data-testid": "address" }, wallet.address ?? "none"), createElement("span", { "data-testid": "chain" }, wallet.chainId ?? "none"), createElement("button", { onClick: wallet.connect }, "connect"), createElement("button", { onClick: wallet.disconnect }, "disconnect"));
}

describe("wallet session lifecycle", () => {
  afterEach(() => cleanup());
  beforeEach(() => { localStorage.clear(); delete window.ethereum; });

  it("connects, disconnects, then reconnects through the same injected provider", async () => {
    let accounts = ["0xca130000000000000000000000000000000000f661"];
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_requestAccounts") return accounts;
      if (method === "eth_accounts") return accounts;
      if (method === "eth_chainId") return "0xf22f";
      return [];
    });
    window.ethereum = { request } as EIP1193Provider;
    render(createElement(WalletProvider, null, createElement(Probe)));
    await waitFor(() => expect(screen.getByTestId("address").textContent).toBe("none"));
    fireEvent.click(screen.getByRole("button", { name: "connect" }));
    await waitFor(() => expect(screen.getByTestId("address").textContent).toBe(accounts[0]));
    expect(localStorage.getItem("aevum:address")).toBe(accounts[0]);
    fireEvent.click(screen.getByRole("button", { name: "disconnect" }));
    await waitFor(() => expect(screen.getByTestId("address").textContent).toBe("none"));
    expect(localStorage.getItem("aevum:address")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "connect" }));
    await waitFor(() => expect(screen.getByTestId("address").textContent).toBe(accounts[0]));
    expect(request.mock.calls.filter(([call]) => call.method === "eth_requestAccounts")).toHaveLength(2);
  });

  it("does not redefine the injected provider and tracks account changes", async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    let accounts = ["0xca130000000000000000000000000000000000f661"];
    const provider: EIP1193Provider = { request: vi.fn(async ({ method }) => method === "eth_accounts" ? accounts : method === "eth_chainId" ? "0xf22f" : []), on: (event, cb) => { listeners.set(event, cb); } };
    window.ethereum = provider;
    render(createElement(WalletProvider, null, createElement(Probe)));
    await waitFor(() => expect(screen.getByTestId("address").textContent).toBe(accounts[0]));
    accounts = ["0xbeef00000000000000000000000000000000beef"];
    listeners.get("accountsChanged")?.(accounts);
    await waitFor(() => expect(screen.getByTestId("address").textContent).toBe(accounts[0]));
    expect(window.ethereum).toBe(provider);
  });
});
