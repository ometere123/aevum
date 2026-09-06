# Aevum

Aevum is a self-preserving on-chain mission trust. A sealed charter fixes the mission, public evidence origins, review cadence, dormancy criteria, succession rules, and treasury release cap. GenLayer consensus re-evaluates continuity; a deterministic vault consumes Core's finalized stewardship state.

## Target

Studionet only: chain ID `61999`, RPC `https://studio.genlayer.com/api`, explorer `https://explorer-studio.genlayer.com`, currency GEN. The contracts use stable py-genlayer v0.2.18 and the browser uses `genlayer-js` 1.1.8.

## Run

Copy `.env.example` to `.env.local`, set deployed Core and Vault addresses, then run `npm install`, `npm run dev`, `npm run typecheck`, `npm run build`, and `npm test`.

`python scripts/compile-contracts.py` performs Python compilation and `python -m pytest tests/direct -q` runs invariant-oriented contract source checks. `pnpm test:integration` is opt-in and refuses to run without `LIVE_STUDIONET=true`.

## Deployment state

This repository is deployment-ready but no funded signer was available in this workspace, so no live address or transaction is claimed. Deploy Core first, then Vault with the Core address, record the source SHA and resulting IDs in `docs/DEPLOYMENT.md`, and populate the public address variables.
