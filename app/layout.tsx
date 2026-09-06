import "./globals.css";
import type { Metadata } from "next";
import { AppShell } from "../components/app-shell";
export const metadata: Metadata = { title:"Aevum — mission continuity", description:"A mission should outlive its operator." };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body><AppShell>{children}</AppShell></body></html>; }
