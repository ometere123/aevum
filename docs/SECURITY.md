# Security model

## Charter immutability

Organization policy is editable only in `DRAFT`. Sealing freezes the mission, succession criteria, timing rules, treasury cap, recovery recipient, closure delay, and ordered public sources into the definition hash. There is no post-seal `set_steward` or arbitrary source replacement method.

## Public evidence

Evidence and manifesto URLs must use HTTPS, are length-bounded, reject credential-bearing inputs, and reject localhost/private/link-local/reserved IP targets. Source count is bounded and organizations require independent source origins before sealing.

Fetched source and manifesto content is hostile prompt data. The semantic prompt explicitly prohibits following source instructions. Validators independently retrieve evidence and claimed excerpts must occur in the validator's own fetch.

Source unavailability, unobservable freshness, or material contradiction fails safe rather than manufacturing ACTIVE/DORMANT/successor state.

## Succession

Successor nominations are self-nominations. A third party cannot nominate an unwilling wallet. Candidate manifesto content is retrieved during review and independently checked against the sealed mission and succession criteria. The model does not directly choose a successor address; deterministic code selects from the agreed candidate assessments.

## Review failures

Semantic `INSUFFICIENT_EVIDENCE` is distinct from infrastructure failure. Malformed model output, consensus/runtime exceptions, or invalid returned payloads produce a retryable technical review record and do not change stewardship by pretending evidence was insufficient.

## Vault authority

Vault is the sole authoritative GEN ledger. Core no longer mirrors a balance through asynchronous child transactions. Core closure reads Vault synchronously.

For normal releases Vault requires:

- organization `ACTIVE`;
- Core spending permission enabled;
- caller equals current steward;
- nonzero recipient;
- positive amount;
- current Vault solvency;
- sealed epoch release cap;
- unused organization-scoped memo/release ID.

The replay key includes organization ID, so one organization's memo cannot grief another organization. Memo hashes must be actual lowercase 32-byte hexadecimal strings.

State is updated before the finalized external transfer. Because GenLayer external value transfer is a child/external message and failed child transfers are not assumed to refund automatically, final deployment evidence must verify recipient balance changes and Vault readbacks on Studionet rather than relying only on bookkeeping.

## Dormant treasury recovery

A dormant organization cannot perform ordinary releases. To avoid trapping treasury value forever, the charter freezes a recovery recipient and closure delay. After the delay, with no active successor nominations, `recover_dormant` can move the remaining accounted Vault balance only to that precommitted address. It is exact-once. Core may close only after the canonical Vault balance is zero.

## Time

Review deadlines, freshness comparisons, epoch rollover, closure delay, and recovery eligibility use deterministic GenVM transaction time. Browser time is display-only.

## Frontend transaction truth

The frontend does not treat wallet approval or a transaction hash as success. It requires finalization, successful execution, and a canonical state reread. User rejection, wrong network, finality timeout, RPC error, execution error, and readback error are separately represented.

## Secrets

No private key, mnemonic, keystore, session token, or funded signer belongs in the repository or browser bundle. `.env` files remain ignored. Only public contract/RPC/explorer configuration may be exposed client-side.

## Residual risks requiring live proof

Before final submission the exact hardened pair must be deployed on Studionet 61999 and tested with real native GEN. The live evidence must demonstrate deposit, permitted release, exact recipient balance increase, dormant restriction/recovery, replay prevention, and reload-safe frontend canonical state. Historical deployments do not prove these revised sources.
