# Aevum lifecycle evidence

This file is an evidence boundary, not a claim of completion.

## Deterministic and direct evidence

- The direct GenLayer suite currently covers 27 executable cases across charter validation, hostile/oversized source inputs, independent review disagreement, bounded retry receipts, delayed interrupted-review recovery, exact Vault funding, accounting conservation, release replay protection, wrong-steward rejection, and invalid deposits.
- GenVM lint passes the Core and Vault safety checks locally. The Windows linter validation phase is blocked by a permissions error while opening the cached pinned SDK; clean Ubuntu CI is the authoritative schema/SDK-validation environment.
- The direct harness is not equivalent to a live Studionet validator committee or a browser-wallet lifecycle.

## Live deployment boundary

The fresh hardened pair is deployed on Studionet and is recorded in `docs/deployment-manifest.json`. Both deployment transactions are FINALIZED with successful execution, and the one-way Core → Vault binding transaction is FINALIZED with successful execution. The canonical readbacks are:

- Core `get_vault_address()` → `0xfEB48492C1b7281223Ea472C16015A541821F10B`
- Vault `get_core_address()` → `0xF0b176855127BcE398E6616DE55efA84929D0e54`

The funded organization lifecycle is still pending. No native GEN movement, steward rotation, dormant recovery, closure, or browser-wallet transaction is claimed until each has a transaction hash, finality, execution result, and canonical readback.

## Required live evidence ledger

When the final source is frozen, record one row per transaction with:

| Step | Transaction | Finality | Execution | Canonical readback |
| --- | --- | --- | --- | --- |
| Core deployment | `0x5aaf92317a4d108a664748a0d3cacbb2968d1c94fd8b9d415af04eb397c588cd` | FINALIZED | SUCCESS | `0xF0b176855127BcE398E6616DE55efA84929D0e54` |
| Vault deployment | `0x0a4f2352e507262087b2ca4084445385dfa16745c6819774d77121d3f3b158fe` | FINALIZED | SUCCESS | `0xfEB48492C1b7281223Ea472C16015A541821F10B` |
| Core → Vault binding | `0xa0e86d376b185d46beb214f602d94920992c943d83b452b6d73fe8eeece1d279` | FINALIZED | SUCCESS | both binding reads match |
| Organization creation | pending | pending | pending | pending |
| Source registration | pending | pending | pending | pending |
| Sealing | pending | pending | pending | pending |
| GEN deposit | pending | pending | pending | funded/released/recovered/balance |
| Continuity review | pending | pending | pending | review receipt and organization state |
| Successor nomination/selection | pending | pending | pending | candidate outcome and steward |
| Release/recovery | pending | pending | pending | Vault accounting and child transfer |
| Closure | pending | pending | pending | CLOSED and zero balance |

Native transfer evidence must identify the triggered child transaction by parent, recipient, exact wei value, finality, and execution. A wallet balance observation alone is not sufficient.
