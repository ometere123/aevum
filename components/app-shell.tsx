"use client";
import Link from "next/link";
import { WalletButton } from "./wallet-button";
export function AppShell({children}:{children:React.ReactNode}) { return <><header className="fixed z-20 top-0 w-full border-b border-[#E9E1CF22] bg-[#0B0B0Add] backdrop-blur-md"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><Link href="/" className="mono text-xs tracking-[.4em] text-[#B8FF5A]">AEVUM / 61999</Link><nav className="hidden gap-6 text-xs text-[#E9E1CF99] md:flex"><Link href="/explore">Explore</Link><Link href="/create">Found an organization</Link><Link href="/docs">Protocol</Link></nav><WalletButton /></div></header><main>{children}</main></>; }
