# Aevum

Aevum is a self-preserving on-chain mission trust. A sealed charter fixes the mission, public evidence origins, review cadence, dormancy criteria, succession rules, and treasury release cap. GenLayer consensus re-evaluates continuity; a deterministic vault consumes Core's finalized stewardship state.

## Target

Studionet only: chain ID `61999`, RPC `https://studio.genlayer.com/api`, explorer `https://explorer-studio.genlayer.com`, currency GEN. The contracts use stable py-genlayer v0.2.18 and the browser uses `genlayer-js` 1.1.8.

## Run

Copy `.env.production.example` to `.env.local` for the verified Studionet deployment, then run `npm install`, `npm run dev`, `npm run typecheck`, `npm run build`, and `npm test`.

`python scripts/compile-contracts.py` performs Python compilation and `python -m pytest tests/direct -q` runs executable direct-mode lifecycle tests. `npm run test:integration` is opt-in and refuses to run without `LIVE_STUDIONET=true`.

## Deployment state

The last matching Core/Vault deployment and its canonical readback are recorded in [`docs/deployment-manifest.json`](docs/deployment-manifest.json). The manifest also records that the final payload-persistence fix is deployed to a fresh Core but does not yet have a matching Vault/lifecycle proof. The frontend must be configured with the exact matching addresses in [`.env.production.example`](.env.production.example); empty values in `.env.example` intentionally fail closed.
