import {describe,expect,it,vi} from "vitest";
import {ensureStudionet,type EIP1193Provider} from "../../lib/genlayer/wallet";

function provider(chain:string, switchError?:unknown){
  let current=chain;
  const calls:{method:string;params?:unknown[]}[]=[];
  const value:EIP1193Provider={request:vi.fn(async(args)=>{
    calls.push(args);
    if(args.method==="eth_chainId") return current;
    if(args.method==="wallet_switchEthereumChain"){
      if(switchError) throw switchError;
      current="0xf22f";
      return null;
    }
    if(args.method==="wallet_addEthereumChain") return null;
    return [];
  })};
  return {provider:value,calls};
}

describe("Aevum injected Studionet guard",()=>{
  it("does not switch when already on Studionet",async()=>{
    const mock=provider("0xf22f");
    await ensureStudionet(mock.provider);
    expect(mock.calls.map(x=>x.method)).toEqual(["eth_chainId","eth_chainId"]);
  });
  it("switches a known network and verifies the result",async()=>{
    const mock=provider("0x1");
    await ensureStudionet(mock.provider);
    expect(mock.calls.map(x=>x.method)).toEqual(["eth_chainId","wallet_switchEthereumChain","eth_chainId"]);
    expect(mock.calls[1].params).toEqual([{chainId:"0xf22f"}]);
  });
  it("adds an unknown network before switching again",async()=>{
    const mock=provider("0x1",{code:4902});
    let first=true;
    mock.provider.request=vi.fn(async(args)=>{
      mock.calls.push(args);
      if(args.method==="eth_chainId") return first?"0x1":"0xf22f";
      if(args.method==="wallet_switchEthereumChain"){if(first){first=false;throw {code:4902}}return null;}
      if(args.method==="wallet_addEthereumChain") return null;
      return [];
    });
    await ensureStudionet(mock.provider);
    expect(mock.calls.map(x=>x.method)).toEqual(["eth_chainId","wallet_switchEthereumChain","wallet_addEthereumChain","wallet_switchEthereumChain","eth_chainId"]);
    expect(mock.calls[2].params).toEqual([expect.objectContaining({chainId:"0xf22f",chainName:"GenLayer Studionet",rpcUrls:["https://studio.genlayer.com/api"]})]);
  });
  it("keeps switch rejection distinct from transaction rejection",async()=>{
    const mock=provider("0x1",{code:4001});
    await expect(ensureStudionet(mock.provider)).rejects.toThrow("Network switch rejected in wallet.");
  });
});
