export const CORE_ABI = [
  { type: "function", name: "create_organization", stateMutability: "nonpayable", inputs: [
    { name: "name", type: "string" }, { name: "mission", type: "string" }, { name: "succession_criteria", type: "string" },
    { name: "review_interval", type: "uint256" }, { name: "dormancy_threshold", type: "uint256" }, { name: "epoch_seconds", type: "uint256" },
    { name: "release_cap", type: "uint256" }, { name: "recovery_recipient", type: "address" }, { name: "closure_delay", type: "uint256" },
  ], outputs: [{ type: "uint256" }] },
  { type: "function", name: "add_source", stateMutability: "nonpayable", inputs: [{ name: "org_id", type: "uint256" }, { name: "label", type: "string" }, { name: "url", type: "string" }, { name: "purpose", type: "string" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "seal_organization", stateMutability: "nonpayable", inputs: [{ name: "org_id", type: "uint256" }], outputs: [] },
  { type: "function", name: "nominate_successor", stateMutability: "nonpayable", inputs: [{ name: "org_id", type: "uint256" }, { name: "candidate", type: "address" }, { name: "manifesto_url", type: "string" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "withdraw_nomination", stateMutability: "nonpayable", inputs: [{ name: "org_id", type: "uint256" }, { name: "candidate_id", type: "uint256" }], outputs: [] },
  { type: "function", name: "trigger_continuity_review", stateMutability: "nonpayable", inputs: [{ name: "org_id", type: "uint256" }], outputs: [] },
  { type: "function", name: "recover_review", stateMutability: "nonpayable", inputs: [{ name: "org_id", type: "uint256" }], outputs: [] },
  { type: "function", name: "close_organization", stateMutability: "nonpayable", inputs: [{ name: "org_id", type: "uint256" }], outputs: [] },
  { type: "function", name: "get_organization", stateMutability: "view", inputs: [{ name: "org_id", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "get_organization_count", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "get_source_by_index", stateMutability: "view", inputs: [{ name: "org_id", type: "uint256" }, { name: "index", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "get_candidate_by_index", stateMutability: "view", inputs: [{ name: "org_id", type: "uint256" }, { name: "index", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "get_review", stateMutability: "view", inputs: [{ name: "review_id", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "is_review_due", stateMutability: "view", inputs: [{ name: "org_id", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "is_spending_enabled", stateMutability: "view", inputs: [{ name: "org_id", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "get_vault_address", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "get_recovery_policy", stateMutability: "view", inputs: [{ name: "org_id", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "can_recover_treasury", stateMutability: "view", inputs: [{ name: "org_id", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const VAULT_ABI = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [{ name: "org_id", type: "uint256" }], outputs: [] },
  { type: "function", name: "release", stateMutability: "nonpayable", inputs: [{ name: "org_id", type: "uint256" }, { name: "recipient", type: "address" }, { name: "amount", type: "uint256" }, { name: "memo_hash", type: "bytes32" }], outputs: [] },
  { type: "function", name: "recover_dormant", stateMutability: "nonpayable", inputs: [{ name: "org_id", type: "uint256" }], outputs: [] },
  { type: "function", name: "get_vault", stateMutability: "view", inputs: [{ name: "org_id", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "remaining_epoch_allowance", stateMutability: "view", inputs: [{ name: "org_id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "was_release_used", stateMutability: "view", inputs: [{ name: "org_id", type: "uint256" }, { name: "memo_hash", type: "bytes32" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "get_core_address", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;
