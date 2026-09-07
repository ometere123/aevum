import { z } from "zod";
export const env = { coreAddress: process.env.NEXT_PUBLIC_CORE_ADDRESS ?? "", vaultAddress: process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? "", network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK ?? "studionet", chainId: Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID ?? 61999), rpc: process.env.NEXT_PUBLIC_GENLAYER_RPC ?? "https://studio.genlayer.com/api", explorer: process.env.NEXT_PUBLIC_GENLAYER_EXPLORER ?? "https://explorer-studio.genlayer.com", demoTiming: process.env.NEXT_PUBLIC_DEMO_TIMING === "true" };
export const envSchema = z.object({chainId:z.literal(61999),network:z.literal("studionet"),rpc:z.literal("https://studio.genlayer.com/api")});
const addressSchema=z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export function assertStudionet(){ const parsed=envSchema.safeParse(env); if(!parsed.success) throw new Error("Aevum requires Studionet 61999 and the stable RPC."); }
export function configuredAddress(address:string){ return addressSchema.safeParse(address).success && address.toLowerCase()!=="0x0000000000000000000000000000000000000000"; }
export function assertConfigured(){ assertStudionet(); if(!configuredAddress(env.coreAddress)||!configuredAddress(env.vaultAddress)) throw new Error("Aevum contract addresses are not configured for this deployment."); }
