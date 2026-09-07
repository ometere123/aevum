# Continuity consensus

Aevum uses one bounded semantic review path for every continuity review. There is no keyword-only or no-candidate shortcut.

## Frozen inputs

A review is bound to the sealed organization definition: mission, succession criteria, review interval, dormancy threshold, treasury policy, recovery policy, and ordered source definitions. Active successor nominations are snapshotted at review start.

## Evidence retrieval

Inside the nondeterministic boundary the leader independently renders every registered continuity source and every active candidate manifesto. Retrieval is bounded and source text is treated as hostile data. Candidate eligibility is never inferred from a URL string alone.

## Material source fields

For each registered source the assessment contains:

- source ID and availability;
- mission alignment;
- whether freshness is observable from attributable dates/times;
- latest relevant activity timestamp;
- whether qualifying activity falls inside the sealed dormancy threshold;
- mission-breach support;
- contradiction state;
- a bounded verbatim excerpt.

For each candidate it contains:

- candidate ID;
- manifesto availability;
- mission compatibility;
- sealed succession-criteria satisfaction;
- a bounded grounded excerpt.

## Independent validation

Validators independently fetch the same frozen URLs and independently derive the same fields. The agreement boundary compares every governance-consequential field: source availability/alignment/freshness/breach/contradiction, candidate availability/compatibility/criteria, activity outcome, successor outcome, and selected candidate ID/address. Free-form reason prose is not compared.

A claimed excerpt must occur in the validator's own fetched material. A fresh result must contain an attributable timestamp that is within `dormancy_threshold` of the review transaction time.

## Deterministic consequence mapping

After the assessments agree, contract logic derives the consequence:

- insufficient independent availability or material contradiction -> `INSUFFICIENT_EVIDENCE`;
- at least two independent fresh mission-aligned sources -> `ACTIVE`;
- at least two independent mission-aligned sources with observable but stale activity and no fresh support -> `DORMANT`;
- independently supported material mission breach -> `MISSION_BREACH`.

When dormant, successor selection is deterministic from candidate assessments. The lowest active candidate ID satisfying the frozen mission and succession criteria becomes the selected successor. The model does not directly choose a governance address.

`ACTIVE` enables spending. `DORMANT`/`MISSION_BREACH` disables spending. A selected successor becomes current steward and returns the organization to active spending authority.

## Failure model

Evidence insufficiency is a semantic result. Runtime/consensus/parser failures are different: they are written as `RETRYABLE_ERROR` review records, pending state is cleared, and no semantic governance finding is invented.

GEN amounts are never produced by consensus. Vault arithmetic, release caps, replay protection, settlement recipients, and dormant recovery are deterministic.
