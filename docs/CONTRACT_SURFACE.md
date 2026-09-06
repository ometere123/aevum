# Contract surface

Core writes: `create_organization`, `add_source`, `seal_organization`, `nominate_successor`, `withdraw_nomination`, `trigger_continuity_review`, `close_organization`.

Core views: `get_organization`, `get_source`, `get_candidate`, `get_review`, `current_steward`, `current_definition_hash`, `is_spending_enabled`, `get_treasury_policy`, `is_review_due`.

Vault writes: payable `deposit`, bounded `release`. Vault views: `get_vault`, `remaining_epoch_allowance`, `was_release_used`.
