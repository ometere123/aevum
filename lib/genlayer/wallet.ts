"use client";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { useCallback, useEffect, useMemo, useState } from "react";
import { env } from "../config";
export type EIP1193Provider = { request:(args:{method:string;params?:unknown[]})=>Promise<unknown>; on?:(event:string,cb:(...args:unknown[])=>void)=>void; removeListener?:(event:string,cb:(...args:unknown[])=>void)=>void };
declare global { interface Window { ethereum?: EIP1193Provider } }
const STUDIONET_CHAIN_ID = "0xf22f";
const STORAGE_KEY = "aevum:address";
const provider = () => typeof window === "undefined" ? undefined : window.ethereum;
const isUserRejected = (error:unknown) => (error as {code?:number})?.code === 4001;

async function readProviderState(current:EIP1193Provider){
 const accounts=await current.request({method:"eth_accounts"}) as string[];
 const chainId=String(await current.request({method:"eth_chainId"}));
 return {address:accounts[0]||undefined,chainId,chainOk:chainId.toLowerCase()===STUDIONET_CHAIN_ID};
}

export async function ensureStudionet(current:EIP1193Provider){
 let chainId=String(await current.request({method:"eth_chainId"}));
 if(chainId.toLowerCase()!==STUDIONET_CHAIN_ID){
  try{await current.request({method:"wallet_switchEthereumChain",params:[{chainId:STUDIONET_CHAIN_ID}]});}
  catch(error){
   if((error as {code?:number})?.code!==4902) throw new Error(isUserRejected(error)?"Network switch rejected in wallet.":"Automatic network switch failed.");
   try{await current.request({method:"wallet_addEthereumChain",params:[{chainId:STUDIONET_CHAIN_ID,chainName:"GenLayer Studionet",nativeCurrency:{name:"GEN",symbol:"GEN",decimals:18},rpcUrls:[env.rpc],blockExplorerUrls:[env.explorer]}]});
    await current.request({method:"wallet_switchEthereumChain",params:[{chainId:STUDIONET_CHAIN_ID}]});
   }catch(addError){throw new Error(isUserRejected(addError)?"Network switch rejected in wallet.":"GenLayer Studionet could not be added to this wallet.")}
  }
 }
 chainId=String(await current.request({method:"eth_chainId"}));
 if(chainId.toLowerCase()!==STUDIONET_CHAIN_ID) throw new Error("Wallet is not on GenLayer Studionet (61999).");
}

export function useWallet(){
 const [address,setAddress]=useState<string>();const [chainId,setChainId]=useState<string>();const [chainOk,setChainOk]=useState(false);const [error,setError]=useState<string>();
 const sync=useCallback(async()=>{const current=provider();if(!current){setAddress(undefined);setChainId(undefined);setChainOk(false);return}try{const state=await readProviderState(current);const saved=localStorage.getItem(STORAGE_KEY);if(state.address){setAddress(state.address);localStorage.setItem(STORAGE_KEY,state.address)}else if(saved){localStorage.removeItem(STORAGE_KEY);setAddress(undefined)}else{setAddress(undefined)}setChainId(state.chainId);setChainOk(state.chainOk)}catch(e){setError(e instanceof Error?e.message:"Wallet state unavailable")}},[]);
 useEffect(()=>{queueMicrotask(()=>{void sync()});const current=provider();if(!current?.on)return;const accountsChanged=()=>{void sync()};const chainChanged=()=>{void sync()};const disconnected=()=>{setAddress(undefined);setChainId(undefined);setChainOk(false);localStorage.removeItem(STORAGE_KEY)};current.on("accountsChanged",accountsChanged);current.on("chainChanged",chainChanged);current.on("disconnect",disconnected);return()=>{current.removeListener?.("accountsChanged",accountsChanged);current.removeListener?.("chainChanged",chainChanged);current.removeListener?.("disconnect",disconnected)}},[sync]);
 const connect=async()=>{try{setError(undefined);const current=provider();if(!current)throw new Error("No browser wallet provider found.");const accounts=await current.request({method:"eth_requestAccounts"}) as string[];if(!accounts[0])throw new Error("Wallet returned no account.");setAddress(accounts[0]);localStorage.setItem(STORAGE_KEY,accounts[0]);const state=await readProviderState(current);setChainId(state.chainId);setChainOk(state.chainOk);if(!state.chainOk){await ensureStudionet(current);await sync()}}catch(e){setError(e instanceof Error?e.message:(isUserRejected(e)?"Wallet connection rejected.":"Wallet connection failed"))}};
 const switchNetwork=async()=>{try{setError(undefined);const current=provider();if(!current)throw new Error("No browser wallet provider found.");await ensureStudionet(current);await sync()}catch(e){setError(e instanceof Error?e.message:"Network switch failed");await sync()}};
 const ensureWriteReady=async()=>{const current=provider();if(!current||!address)throw new Error("Connect a wallet before signing.");const state=await readProviderState(current);if(!state.address||state.address.toLowerCase()!==address.toLowerCase())throw new Error("Wallet account changed. Reconnect before signing.");if(!state.chainOk){await ensureStudionet(current);await sync()}const verified=await readProviderState(current);if(!verified.chainOk)throw new Error("WRONG_NETWORK: switch wallet to Studionet 61999");return {client:createClient({chain:studionet,account:verified.address as `0x${string}`,provider:current as never}),provider:current,address:verified.address as string};};
 const writeClient=useMemo(()=>address&&chainOk&&provider()?createClient({chain:studionet,account:address as `0x${string}`,provider:provider() as never}):undefined,[address,chainOk]);
 const disconnect=()=>{setAddress(undefined);setChainId(undefined);setChainOk(false);setError(undefined);localStorage.removeItem(STORAGE_KEY)};
 return {address,chainId,chainOk,error,connect,disconnect,switchNetwork,ensureWriteReady,readClient:createClient({chain:studionet}),writeClient};
}
