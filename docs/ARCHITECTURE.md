# Architecture

Aevum has two Intelligent Contracts and a browser-only client. Core owns organization, charter, source, successor, and review state. Core uses bounded public evidence and a leader/validator consensus boundary; validators re-fetch sources and verify excerpts and consequential outcomes. Vault owns GEN accounting and calls Core through a typed contract interface. It never evaluates activity.

There is no application backend or authoritative database. The browser reads Core/Vault and submits wallet-signed writes. Local storage is intentionally unused for protocol state. The major trust boundary is fetched web evidence, which is treated as hostile prompt data and bounded before consensus.
