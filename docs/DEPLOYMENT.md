# Deployment

1. Verify the contract source SHA with `pnpm contract:sha`.
2. Run `pnpm network:guard`, `python scripts/compile-contracts.py`, and the direct tests.
3. Deploy `contracts/aevum_core.py` to Studionet 61999 with the pinned v0.2.18 runner.
4. Deploy `contracts/aevum_vault.py` using the finalized Core address.
5. Record Git SHA, source SHA-256, addresses, deployment transaction IDs, explorer links, consensus status, and execution status here.
6. Set `NEXT_PUBLIC_CORE_ADDRESS` and `NEXT_PUBLIC_VAULT_ADDRESS`; run the production build.

Never report a transaction hash as an application result. A write is complete only after finality, execution confirmation, and an authoritative post-write read.
