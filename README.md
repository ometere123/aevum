# Aevum

Aevum is a self-preserving on-chain mission trust for GenLayer Studionet. A sealed charter fixes the mission, succession criteria, public evidence origins, review cadence, dormancy threshold, treasury release policy, dormant recovery recipient, and closure delay. GenLayer validators independently re-evaluate public evidence; deterministic Core state changes stewardship and spending permission; Vault is the sole authority for native GEN accounting and releases.

## Target

Canonical network only:

- Studionet
- chain ID `61999`
- RPC `https://studio.genlayer.com/api`
- explorer `https://explorer-studio.genlayer.com`
- currency `GEN`
- browser SDK `genlayer-js` `1.1.8`
- stable contract runner `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`

No Bradbury or Studio-dev configuration belongs in the canonical app.

## Architecture

`AevumCore` owns charter, sources, candidate nominations, continuity reviews, steward identity and spending permission. Every review uses the same semantic evidence path. Source freshness is assessed against the sealed `dormancy_threshold`; validator checks independently re-fetch the registered sources and candidate manifestos and compare every consequential field. Candidate selection itself is deterministic: when an organization is dormant, the lowest active candidate ID whose independently verified manifesto satisfies the sealed succession criteria is selected.

`AevumVault` owns funded/released/recovered accounting. It synchronously reads Core for steward, spending and recovery permissions. Core does not maintain an authoritative shadow treasury balance. Release replay protection is namespaced by organization, epoch limits roll over consistently in both writes and reads, and dormant recovery can only send the remaining treasury to the precommitted recovery recipient after the sealed delay.

The browser has no application database or backend authority. Wallet-signed writes wait for finalization, verify execution success, and then re-read canonical Core/Vault state before displaying success.

## Local verification

Frontend:

```bash
npm install
npm run network:guard
npm run env:check
npm run typecheck
npm run lint
npm test
npm run build
npm run contract:sha
```

Contracts (Python 3.12):

```bash
python -m pip install -r requirements-direct.txt
python -m compileall contracts scripts tests/direct
genvm-lint check contracts/aevum_core.py
genvm-lint check contracts/aevum_vault.py
python -m pytest tests/direct -v
```

`requirements-direct.txt` pins the direct-test and GenVM validation toolchain. JavaScript package versions are pinned in `package.json`; a maintainer with normal npm network access should generate and commit `package-lock.json` before merging if one is still absent.

## Deployment status

The historical pair in [`docs/deployment-manifest.json`](docs/deployment-manifest.json) predates the hardening changes and is explicitly **superseded**. Do not point the final frontend at those addresses.

The hardening branch requires a fresh matching deployment:

1. deploy final Core source to Studionet;
2. deploy final Vault against that Core;
3. call Core `set_vault_address` once with the new Vault;
4. verify Core→Vault and Vault→Core readbacks;
5. record source SHA-256 values and deployment transactions;
6. run a funded continuity/treasury lifecycle on that exact pair;
7. configure the public frontend with those exact addresses;
8. perform browser-wallet proof and update the deployment manifest.

No final hardened deployment, funded native GEN lifecycle, or browser-wallet proof is claimed until those steps have real transaction evidence.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/CONSENSUS.md`](docs/CONSENSUS.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/CONTRACT_SURFACE.md`](docs/CONTRACT_SURFACE.md)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- [`docs/REVIEWER_DEMO.md`](docs/REVIEWER_DEMO.md)
- [`docs/HARDENING_STATUS.md`](docs/HARDENING_STATUS.md)
- [`docs/LIFECYCLE_EVIDENCE.md`](docs/LIFECYCLE_EVIDENCE.md)
