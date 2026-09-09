export type CoreOrganizationState = Record<string, unknown>;

export function assertRecoveredReviewReadback(before: CoreOrganizationState, after: CoreOrganizationState): void {
  if (after.status !== before.review_prior_status) throw new Error("STATE_MISMATCH: recovery did not restore the pre-review status");
  if (Boolean(after.spending_enabled) !== Boolean(before.review_prior_spending_enabled)) throw new Error("STATE_MISMATCH: recovery changed spending permission");
  if (Number(after.pending_review_id) !== 0) throw new Error("STATE_MISMATCH: pending review was not cleared");
  if (Number(after.latest_review_id) !== Number(before.latest_review_id)) throw new Error("STATE_MISMATCH: recovered review ID was not preserved");
  if (after.current_steward !== before.current_steward || Number(after.dormant_since) !== Number(before.dormant_since)) throw new Error("STATE_MISMATCH: recovery changed steward or dormancy state");
}

export function assertClosedOrganizationReadback(after: CoreOrganizationState): void {
  if (after.status !== "CLOSED" || Boolean(after.spending_enabled) || Number(after.closed_at) <= 0) throw new Error("STATE_MISMATCH: organization did not become CLOSED");
}
