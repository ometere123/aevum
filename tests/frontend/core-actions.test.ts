import {describe, expect, it} from "vitest";
import {assertClosedOrganizationReadback, assertRecoveredReviewReadback} from "../../lib/genlayer/core-actions";

describe("Core recovery and closure canonical readbacks", () => {
  it.each([
    ["ACTIVE", true], ["REVIEW_DUE", false], ["DORMANT", false],
  ])("recovery restores the persisted %s state and spending flag", (status, spending) => {
    const before = {status: "REVIEWING", review_prior_status: status, review_prior_spending_enabled: spending, pending_review_id: 2, latest_review_id: 2, current_steward: "0xabc", dormant_since: status === "DORMANT" ? 123 : 0};
    expect(() => assertRecoveredReviewReadback(before, {...before, status, spending_enabled: spending, pending_review_id: 0})).not.toThrow();
  });

  it("rejects a recovery that changes the prior state", () => {
    const before = {review_prior_status: "DORMANT", review_prior_spending_enabled: false, pending_review_id: 2, latest_review_id: 2, current_steward: "0xabc", dormant_since: 123};
    expect(() => assertRecoveredReviewReadback(before, {...before, status: "REVIEW_DUE", spending_enabled: false, pending_review_id: 0})).toThrow("pre-review status");
  });

  it("accepts only a canonical CLOSED state", () => {
    expect(() => assertClosedOrganizationReadback({status: "CLOSED", spending_enabled: false, closed_at: 456})).not.toThrow();
    expect(() => assertClosedOrganizationReadback({status: "DORMANT", spending_enabled: false, closed_at: 0})).toThrow();
  });
});
