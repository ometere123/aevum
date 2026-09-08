import { z } from "zod";

const canonicalStudionetCore = "0xF0b176855127BcE398E6616DE55efA84929D0e54";
const canonicalStudionetVault = "0xfEB48492C1b7281223Ea472C16015A541821F10B";
const network = process.env.NEXT_PUBLIC_GENLAYER_NETWORK ?? "studionet";

export const env = {
  coreAddress: network === "studionet" ? canonicalStudionetCore : (process.env.NEXT_PUBLIC_CORE_ADDRESS ?? ""),
  vaultAddress: network === "studionet" ? canonicalStudionetVault : (process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? ""),
  network,
  chainId: Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID ?? 61999),
  rpc: process.env.NEXT_PUBLIC_GENLAYER_RPC ?? "https://studio.genlayer.com/api",
  explorer: process.env.NEXT_PUBLIC_GENLAYER_EXPLORER ?? "https://explorer-studio.genlayer.com",
  demoTiming: process.env.NEXT_PUBLIC_DEMO_TIMING === "true",
};
export const envSchema = z.union([z.object({chainId:z.literal(61999),network:z.literal("studionet"),rpc:z.literal("https://studio.genlayer.com/api")}),z.object({chainId:z.literal(61999),network:z.literal("localnet"),rpc:z.literal("http://127.0.0.1:4000/api")})]);
const addressSchema=z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export function assertStudionet(){ const parsed=envSchema.safeParse(env); const localAllowed=env.network==="localnet"&&process.env.AEVUM_LOCALNET_ENABLED==="true"&&process.env.NODE_ENV!=="production"; if(!parsed.success||(!localAllowed&&env.network!=="studionet")) throw new Error("Aevum requires Studionet 61999 and the stable RPC."); }
export function configuredAddress(address:string){ return addressSchema.safeParse(address).success && address.toLowerCase()!=="0x0000000000000000000000000000000000000000"; }
export function assertConfigured(){ assertStudionet(); if(!configuredAddress(env.coreAddress)||!configuredAddress(env.vaultAddress)) throw new Error("Aevum contract addresses are not configured for this deployment."); if(env.coreAddress.toLowerCase()===env.vaultAddress.toLowerCase()) throw new Error("Core and Vault addresses must be different."); }
