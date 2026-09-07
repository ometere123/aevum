# Architecture

Aevum is a browser-only application backed by two GenLayer Intelligent Contracts on Studionet (chain 61999): `AevumCore` and `AevumVault`. There is no application database, server wallet, centralized evidence service, or backend adjudicator.

## Core

Core owns the continuity charter and authoritative governance state:

- organization identity and current steward;
- sealed mission and succession criteria;
- independent public evidence sources;
- review cadence and dormancy threshold;
- treasury release policy;
- precommitted dormant-recovery recipient and closure delay;
- successor self-nominations and manifesto URLs;
- review receipts and continuity consequences.

Each organization stores its own ordered source and candidate ID indexes. The global source/candidate counters are identifiers only; reads and review iteration do not scan unrelated organizations.

A charter is mutable only while `DRAFT`. Sealing hashes the mission, succession criteria, timing rules, treasury policy, recovery policy, and ordered source definitions. The resulting definition hash is the policy identity used by review receipts.

## Continuity review

Every live continuity review uses the same nondeterministic evidence path, including reviews with no successor candidate. There is no keyword-only ACTIVE shortcut.

The leader independently retrieves each registered public source and each active candidate manifesto. The semantic assessment records per-source availability, mission alignment, whether freshness can actually be observed, a bounded latest-activity timestamp, whether activity is inside the sealed dormancy threshold, mission-breach support, contradiction state, and a grounded excerpt. Candidate assessments record manifesto availability, mission compatibility, sealed-criteria satisfaction, and a grounded excerpt.

Validators independently retrieve the same URLs and independently derive those fields. Agreement compares all state-consequential fields. Free-form reason text is not an equality boundary.

The contract then deterministically derives the continuity state. Insufficient availability or contradictory material fails safe. Two independent fresh mission-aligned sources can establish `ACTIVE`. Two sufficiently observable mission-aligned sources with no qualifying fresh activity can establish `DORMANT`. Material mission breach requires independent supporting evidence. Successor selection is deterministic from the independently agreed candidate assessments rather than an LLM-selected payout/governance address.

Technical/runtime failures are recorded as retryable review errors and do not masquerade as an `INSUFFICIENT_EVIDENCE` finding.

## Vault

Vault is the sole authority for GEN accounting. It stores funded, released, recovered, epoch-start, epoch-spent, replay and recovery state. Core does not mirror a treasury balance and therefore does not depend on an asynchronous child write for a security decision.

For normal releases Vault synchronously reads Core for:

- current organization state;
- current steward;
- spending permission;
- sealed epoch length and release cap.

Release IDs are namespaced by organization. State is updated before the finalized outbound transfer. The amount and recipient come from the signed call subject to Core/Vault rules; no semantic model chooses a GEN amount.

After a dormant organization has remained dormant for the sealed closure delay and has no active successor nomination, `recover_dormant` may clear the remaining treasury only to the recovery recipient frozen in the charter. Once Vault balance is zero, Core can close the organization. This avoids the previous dormant-funds deadlock.

## Cross-contract binding

Deployment order is:

1. deploy Core;
2. deploy Vault with Core address;
3. call Core `set_vault_address` once with the Vault address;
4. verify `Core.get_vault_address()` equals Vault;
5. verify `Vault.get_core_address()` equals Core.

The binding is one-time on Core and immutable in Vault construction.

## Browser client

The browser uses `genlayer-js` 1.1.8 and the `studionet` chain definition. Public reads use an unsigned client. Writes use the connected EIP-1193 wallet.

Write success requires all of the following:

1. wallet signature;
2. transaction submission;
3. `FINALIZED` status;
4. successful execution result;
5. an authoritative Core/Vault reread proving the expected state change.

The client exposes the transaction hash and Studionet Explorer link. Wallet rejection, wrong network, RPC/finality failure, execution failure, and canonical readback failure are distinct UI states.

## Remaining deployment boundary

The hardened branch changes both contract sources, so every address documented before this branch is historical. A new matching Core/Vault pair must be deployed from the exact final commit before any production or lifecycle claim is made.
