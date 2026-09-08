# Aevum lifecycle evidence

This file is an evidence boundary, not a claim of completion.

## Deterministic and direct evidence

- The direct GenLayer suite currently covers 27 executable cases across charter validation, hostile/oversized source inputs, independent review disagreement, bounded retry receipts, delayed interrupted-review recovery, exact Vault funding, accounting conservation, release replay protection, wrong-steward rejection, and invalid deposits.
- GenVM lint passes the Core and Vault safety checks locally. The Windows linter validation phase is blocked by a permissions error while opening the cached pinned SDK; clean Ubuntu CI is the authoritative schema/SDK-validation environment.
- The direct harness is not equivalent to a live Studionet validator committee or a browser-wallet lifecycle.

## Live deployment boundary

No final Aevum Core/Vault deployment is recorded by this repository state. `docs/deployment-manifest.json` therefore intentionally has null canonical deployment fields and marks its historical pair as superseded. No public frontend, native GEN movement, steward rotation, dormant recovery, closure, or browser-wallet transaction should be described as live-proven until hashes, finality, execution results, and canonical readbacks are added here.

## Required live evidence ledger

When the final source is frozen, record one row per transaction with:

| Step | Transaction | Finality | Execution | Canonical readback |
| --- | --- | --- | --- | --- |
| Core deployment | pending | pending | pending | pending |
| Vault deployment | pending | pending | pending | pending |
| Core → Vault binding | pending | pending | pending | pending |
| Organization creation | pending | pending | pending | pending |
| Source registration | pending | pending | pending | pending |
| Sealing | pending | pending | pending | pending |
| GEN deposit | pending | pending | pending | funded/released/recovered/balance |
| Continuity review | pending | pending | pending | review receipt and organization state |
| Successor nomination/selection | pending | pending | pending | candidate outcome and steward |
| Release/recovery | pending | pending | pending | Vault accounting and child transfer |
| Closure | pending | pending | pending | CLOSED and zero balance |

Native transfer evidence must identify the triggered child transaction by parent, recipient, exact wei value, finality, and execution. A wallet balance observation alone is not sufficient.
