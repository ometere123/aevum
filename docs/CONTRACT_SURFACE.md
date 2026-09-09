# Contract surface

Core writes: `create_organization`, `add_source`, `seal_organization`, `nominate_successor`, `withdraw_nomination`, `trigger_continuity_review`, `recover_review`, `close_organization`.

Core views: `get_organization`, `get_source`, `get_candidate`, `get_review`, `current_steward`, `current_definition_hash`, `is_spending_enabled`, `get_treasury_policy`, `is_review_due`.

Vault writes: payable `deposit`, bounded `release`, and guarded `recover_dormant`. Vault views: `get_vault`, `remaining_epoch_allowance`, `was_release_used`.

`recover_review(org_id)` is a permissionless liveness action for an interrupted review after the sealed recovery delay. It restores the persisted pre-review status and spending permission and clears the pending review. `close_organization(org_id)` is available only after the Core's dormant, candidate, delay, and zero-treasury guards pass. `recover_dormant(org_id)` is the Vault-side exact-once treasury recovery to the charter's sealed recovery recipient.
