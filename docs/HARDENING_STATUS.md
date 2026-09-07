# Hardening status

Branch: `phase1-5-hardening`

This document is intentionally conservative. It records what has been changed in source and what still requires executable/live proof. It must not be used to claim a final deployment before the missing items are completed.

## Completed in source

### Core

- Removed keyword-only continuity projection.
- Every due continuity review now uses the same bounded semantic evidence path.
- Registered sources are independently fetched by leader and validators.
- Freshness is evaluated against the sealed `dormancy_threshold`.
- Source assessments include availability, mission alignment, freshness observability, recent activity, latest activity time, mission-breach signal, contradiction signal and grounded excerpt.
- Candidate manifesto URLs are actually fetched inside the nondeterministic boundary.
- Candidate assessments include manifesto availability, mission compatibility and sealed succession-criteria satisfaction.
- Successor nominations are self-nominations.
- Candidate selection is deterministic rather than model-selected.
- Consequential source/candidate fields are compared by validators.
- Consensus payload is persisted directly; no third post-consensus internet re-fetch is used.
- Semantic `INSUFFICIENT_EVIDENCE` is distinct from technical `RETRYABLE_ERROR` review records.
- Per-organization source/candidate ID arrays replace global scans.
- Added organization-indexed source/candidate views for frontend correctness.
- Added sealed recovery recipient and closure delay.
- Dormant organizations may be reviewed again.
- Core closure checks the canonical Vault balance through a synchronous cross-contract view.
- Core no longer treats an asynchronously mirrored treasury balance as authoritative.

### Vault

- Vault is the sole accounting authority for funded/released/recovered GEN.
- Removed asynchronous Core balance synchronization.
- Release IDs are namespaced by organization.
- Memo hashes are validated as 32-byte hex strings.
- Epoch allowance view applies logical rollover after expiry.
- Dormant treasury recovery is explicit and exact-once.
- Recovery beneficiary comes only from the sealed Core recovery policy.
- Release/recovery accounting is updated before outbound transfer emission.
- Cross-contract Core address is readable for binding verification.

### Frontend foundations

- Stable Studionet 61999 configuration retained.
- `genlayer-js` stays exactly `1.1.8`.
- Per-organization source/candidate reads use index views rather than assuming global IDs start at one.
- Charter form includes succession criteria, recovery recipient, closure delay and GEN-denominated release cap.
- Create/add/seal/nominate/deposit/release flows perform canonical post-finalization state checks.
- Successor register displays canonical candidate records and supports withdrawal by the nominated wallet.
- Treasury accepts exact decimal GEN deposits/releases instead of a fixed deposit/raw-wei-only release.
- Release recipient is explicit.
- Release memo is deterministically hashed and its replay record is checked after finalization.
- Treasury displays both GEN and wei and verifies Core/Vault binding reads.
- Explorer links are preserved with transaction evidence.
- Wallet rejection, wrong-network, finality timeout, execution failure, readback failure and state mismatch have distinct handling.

### Engineering

- Direct/GenVM tooling is pinned in `requirements-direct.txt`.
- JavaScript package versions are pinned in `package.json`.
- CI is split into frontend and contract jobs.
- Contract CI installs Python dependencies, compiles Python, runs GenVM lint and direct tests.
- Frontend CI runs Studionet guard, env validation, typecheck, lint, unit tests, production build and contract SHA output.
- Historical deployment manifest is explicitly marked superseded by hardening source.

## Still requires proof or completion

These items require a normal local/CI/deployment environment or a real browser wallet and must be completed before claiming the hardened build is final.

1. **CI must be green on the final hardening commit.** Inspect both jobs and fix genuine failures without weakening protocol invariants.
2. **Generate/commit `package-lock.json`** using the pinned `package.json` if it is still absent.
3. **Run the complete direct suite** and add any missing Vault-specific executable tests discovered by CI/runtime work.
4. **Confirm GenVM lint/schema compatibility** of both exact final contract sources with the stable 61999 runner.
5. **Fresh Studionet deployment:** deploy Core, deploy Vault against Core, then bind Core to Vault once.
6. **Source parity:** compute exact source SHA-256 values and prove deployed source matches the final Git commit.
7. **Funded native GEN lifecycle:** deposit real test GEN, verify Vault balance, perform an allowed release, verify exact Vault accounting and recipient balance, exercise cap/replay protections.
8. **Continuity lifecycle:** prove ACTIVE, INSUFFICIENT_EVIDENCE and DORMANT behavior against controlled public evidence; where possible prove SUCCESSOR_SELECTED against a real candidate manifesto.
9. **Dormant recovery/closure:** on a controlled organization, prove recovery goes only to the sealed recovery recipient and the cleared treasury can close after the delay.
10. **Public frontend:** deploy the frontend configured with the exact new Core/Vault pair.
11. **Browser-wallet proof:** use the user's real browser wallet, including one intentionally rejected signature, reload/readback proof and wrong-network recovery.
12. **Final documentation:** replace null canonical deployment fields in `deployment-manifest.json` with real values and attach all relevant Explorer transactions.

## Historical addresses

The previous Studionet Core/Vault addresses remain historical evidence only. They must not be represented as the deployment of the hardened contracts.

See `docs/deployment-manifest.json` for the preserved historical records.

## Stop conditions for the handoff agent

Do not make broad contract changes automatically after a live failure. On the first new runtime/deployment blocker:

- capture the transaction;
- finality state;
- execution result;
- complete error/stderr where available;
- exact source SHA;
- failing method and arguments;
- canonical before/after reads;

then isolate the failing API/state invariant before changing protocol logic.
