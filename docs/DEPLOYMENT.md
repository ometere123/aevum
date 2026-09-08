# Deployment

1. Verify the contract source SHA with `npm run contract:sha`.
2. Run `npm run network:guard`, `python scripts/compile-contracts.py`, and the direct tests.
3. Deploy `contracts/aevum_core.py` to Studionet 61999 with the pinned runner declared in the contract header and `requirements-direct.txt`.
4. Deploy `contracts/aevum_vault.py` using the finalized Core address.
5. Record Git SHA, source SHA-256, addresses, deployment transaction IDs, explorer links, consensus status, and execution status here.
6. Set `NEXT_PUBLIC_CORE_ADDRESS` and `NEXT_PUBLIC_VAULT_ADDRESS`; run the production build.

Never report a transaction hash as an application result. A write is complete only after finality, execution confirmation, and an authoritative post-write read.

`docs/deployment-manifest.json` is the source of truth for addresses and transaction evidence. Until its canonical fields are populated with a fresh source-matching pair, deployment remains unverified.
