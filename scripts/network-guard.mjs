const expected={network:"studionet",chainId:61999,rpc:"https://studio.genlayer.com/api"};
for(const [k,v] of Object.entries(expected)){const actual=process.env[k.toUpperCase()] ?? process.env[`NEXT_PUBLIC_GENLAYER_${k.toUpperCase()}`]; if(actual && String(actual)!==String(v)) throw new Error(`Network guard failed for ${k}: ${actual}`)}
console.log(JSON.stringify(expected));
