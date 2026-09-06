# Security model

Core has no post-seal steward setter. Source URLs require HTTPS, are bounded, and reject obvious credential parameters. Charter rules freeze at sealing. Reviews are due by deterministic contract time. Vault checks Core's current steward and spending flag, applies balance and epoch caps, updates accounting before transfer, and prevents release-hash replay.

Residual risks: public-source availability and semantic classification can remain inconclusive; the contract intentionally fails closed. Native-value behavior should be rechecked against the deployed Studionet runner before accepting funds. No private key is bundled or read by the frontend.
