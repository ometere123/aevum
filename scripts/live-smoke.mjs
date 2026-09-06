if(process.env.LIVE_STUDIONET!=="true") throw new Error("Opt-in only: set LIVE_STUDIONET=true and provide a funded signer outside CI.");
console.log("Live smoke requires an explicitly configured funded wallet and is not run automatically.");
