import json
import pytest


def account_address(account):
    if isinstance(account, (bytes, bytearray)):
        return "0x" + bytes(account).hex()
    return account.address.lower()


def warp(direct_vm, timestamp):
    direct_vm.warp(timestamp)
    import genlayer.gl as gl
    gl.message_raw["datetime"] = timestamp


def deploy_core(direct_deploy, direct_vm, alice):
    core = direct_deploy("contracts/aevum_core.py")
    direct_vm.sender = alice
    return core


def create_draft(core, direct_vm, owner, name="Aevum Test", interval=60, dormancy=120, closure_delay=60):
    return core.create_organization(
        name,
        "Maintain a public mission with measurable continuity evidence.",
        "A successor must publicly commit to the sealed mission and show a credible continuation plan.",
        interval,
        dormancy,
        3600,
        1000,
        owner,
        closure_delay,
    )


def add_two_sources(core, org_id):
    core.add_source(org_id, "Repository", "https://github.com/aevum-test/repo", "repo")
    core.add_source(org_id, "Official site", "https://aevum-test.org/mission", "official_site")


def configure_source_web(direct_vm, body):
    direct_vm.mock_web(r".*github\.com.*", {"status": 200, "body": body})
    direct_vm.mock_web(r".*aevum-test\.org.*", {"status": 200, "body": body})


def response(review_time, recent=True, breach=False, contradictory=False, candidates=None, source_ids=(1, 2)):
    candidates = candidates or []
    latest = review_time - 30 if recent else review_time - 1000
    return json.dumps(
        {
            "sources": [
                {
                    "source_id": source_ids[0],
                    "available": True,
                    "mission_aligned": not breach,
                    "freshness_observable": True,
                    "recent_activity": recent and not breach,
                    "latest_activity_at": latest,
                    "mission_breach": breach,
                    "contradictory": contradictory,
                    "excerpt": "Mission evidence 2030",
                },
                {
                    "source_id": source_ids[1],
                    "available": True,
                    "mission_aligned": not breach,
                    "freshness_observable": True,
                    "recent_activity": recent and not breach,
                    "latest_activity_at": latest,
                    "mission_breach": breach,
                    "contradictory": contradictory,
                    "excerpt": "Mission evidence 2030",
                },
            ],
            "candidates": candidates,
            "reason": "bounded evidence result",
        }
    )


def test_create_bounds_and_private_sources(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    with direct_vm.expect_revert("invalid organization name"):
        create_draft(core, direct_vm, direct_alice, name="x")
    org_id = create_draft(core, direct_vm, direct_alice)
    with direct_vm.expect_revert("invalid source URL"):
        core.add_source(org_id, "Bad", "http://not-secure.example", "repo")
    with direct_vm.expect_revert("private host"):
        core.add_source(org_id, "Private", "https://127.0.0.1/a", "repo")


def test_seal_requires_independent_sources_and_freezes_definition(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice)
    core.add_source(org_id, "One", "https://one.example/a", "repo")
    with direct_vm.expect_revert("at least two sources"):
        core.seal_organization(org_id)
    core.add_source(org_id, "Two", "https://two.example/a", "official_site")
    core.seal_organization(org_id)
    definition = core.current_definition_hash(org_id)
    assert definition
    with direct_vm.expect_revert("charter is not draft"):
        core.add_source(org_id, "Three", "https://three.example/a", "governance")
    assert core.current_definition_hash(org_id) == definition


def test_org_scoped_source_indexes_work_for_second_org(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    first = create_draft(core, direct_vm, direct_alice, name="First Org")
    add_two_sources(core, first)
    second = create_draft(core, direct_vm, direct_alice, name="Second Org")
    core.add_source(second, "Second repo", "https://second-repo.example/a", "repo")
    core.add_source(second, "Second site", "https://second-site.example/a", "official_site")
    source = json.loads(core.get_source_by_index(second, 0))
    assert source["org_id"] == second
    assert source["source_id"] == 3


def test_successor_must_self_nominate_and_can_withdraw(direct_vm, direct_deploy, direct_alice, direct_bob):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice)
    add_two_sources(core, org_id)
    core.seal_organization(org_id)
    with direct_vm.expect_revert("self-nominations"):
        core.nominate_successor(org_id, direct_bob, "https://bob.example/manifesto")
    with direct_vm.prank(direct_bob):
        candidate_id = core.nominate_successor(org_id, direct_bob, "https://bob.example/manifesto")
        core.withdraw_nomination(org_id, candidate_id)
    item = json.loads(core.get_candidate_by_index(org_id, 0))
    assert item["active"] is False
    assert item["latest_outcome"] == "WITHDRAWN"


def test_active_review_requires_freshness_inside_threshold(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice, dormancy=120)
    add_two_sources(core, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    warp(direct_vm, "2030-01-01T00:02:00Z")
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_llm(r"Assess mission continuity", response(1893456120, recent=True))
    core.trigger_continuity_review(org_id)
    assert direct_vm.run_validator() is True
    org = json.loads(core.get_organization(org_id))
    assert org["status"] == "ACTIVE"
    assert org["last_outcome"] == "ACTIVE"
    assert org["spending_enabled"] is True


def test_stale_observable_evidence_becomes_dormant(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice, dormancy=120)
    add_two_sources(core, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    warp(direct_vm, "2030-01-01T00:02:00Z")
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_llm(r"Assess mission continuity", response(1893456120, recent=False))
    core.trigger_continuity_review(org_id)
    assert direct_vm.run_validator() is True
    org = json.loads(core.get_organization(org_id))
    assert org["status"] == "DORMANT"
    assert org["spending_enabled"] is False
    assert org["dormant_since"] == 1893456120


def test_contradictory_evidence_fails_safe(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice)
    add_two_sources(core, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    warp(direct_vm, "2030-01-01T00:02:00Z")
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_llm(r"Assess mission continuity", response(1893456120, recent=True, contradictory=True))
    core.trigger_continuity_review(org_id)
    assert direct_vm.run_validator() is True
    org = json.loads(core.get_organization(org_id))
    assert org["last_outcome"] == "INSUFFICIENT_EVIDENCE"
    assert org["current_steward"] == account_address(direct_alice)


def test_candidate_manifesto_is_fetched_and_lowest_eligible_id_selected(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice, dormancy=120)
    add_two_sources(core, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    with direct_vm.prank(direct_bob):
        c1 = core.nominate_successor(org_id, direct_bob, "https://bob.example/manifesto")
    with direct_vm.prank(direct_charlie):
        c2 = core.nominate_successor(org_id, direct_charlie, "https://charlie.example/manifesto")
    direct_vm.mock_web(r".*bob\.example.*", {"status": 200, "body": "Continue the sealed mission"})
    direct_vm.mock_web(r".*charlie\.example.*", {"status": 200, "body": "Continue the sealed mission"})
    configure_source_web(direct_vm, "Mission evidence 2030")
    warp(direct_vm, "2030-01-01T00:02:00Z")
    candidate_rows = [
        {"candidate_id": c1, "available": True, "mission_compatible": True, "criteria_met": True, "excerpt": "Continue the sealed mission"},
        {"candidate_id": c2, "available": True, "mission_compatible": True, "criteria_met": True, "excerpt": "Continue the sealed mission"},
    ]
    direct_vm.mock_llm(r"Assess mission continuity", response(1893456120, recent=False, candidates=candidate_rows))
    core.trigger_continuity_review(org_id)
    assert direct_vm.run_validator() is True
    assert core.current_steward(org_id) == account_address(direct_bob)
    review = json.loads(core.get_review(1))
    assert review["successor_outcome"] == "SUCCESSOR_SELECTED"
    assert review["selected_candidate_id"] == c1


def test_missing_candidate_manifesto_cannot_select_successor(direct_vm, direct_deploy, direct_alice, direct_bob):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice)
    add_two_sources(core, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    with direct_vm.prank(direct_bob):
        cid = core.nominate_successor(org_id, direct_bob, "https://bob.example/manifesto")
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_web(r".*bob\.example.*", {"status": 200, "body": ""})
    warp(direct_vm, "2030-01-01T00:02:00Z")
    candidate_rows = [{"candidate_id": cid, "available": False, "mission_compatible": False, "criteria_met": False, "excerpt": ""}]
    direct_vm.mock_llm(r"Assess mission continuity", response(1893456120, recent=False, candidates=candidate_rows))
    core.trigger_continuity_review(org_id)
    assert direct_vm.run_validator() is True
    review = json.loads(core.get_review(1))
    assert review["successor_outcome"] == "INSUFFICIENT_EVIDENCE"
    assert review["selected_candidate_id"] == -1


def test_malformed_consensus_is_retryable_error_not_evidence_finding(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice)
    add_two_sources(core, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    warp(direct_vm, "2030-01-01T00:02:00Z")
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_llm(r"Assess mission continuity", json.dumps({"bad": "shape"}))
    core.trigger_continuity_review(org_id)
    review = json.loads(core.get_review(1))
    assert review["review_state"] == "RETRYABLE_ERROR"
    assert review["finalized"] is False
    org = json.loads(core.get_organization(org_id))
    assert org["status"] == "REVIEW_DUE"


def test_review_deadline_boundary(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice, interval=100)
    add_two_sources(core, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    warp(direct_vm, "2030-01-01T00:01:39Z")
    assert core.is_review_due(org_id) is False
    warp(direct_vm, "2030-01-01T00:01:40Z")
    assert core.is_review_due(org_id) is True


def test_vault_rejects_invalid_core_address(direct_vm, direct_deploy):
    with direct_vm.expect_revert("invalid Core contract address"):
        direct_deploy("contracts/aevum_vault.py", "0x0000000000000000000000000000000000000000")


def test_latest_review_id_is_global_and_org_scoped_with_interleaved_reviews(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    first = create_draft(core, direct_vm, direct_alice, name="First Org")
    add_two_sources(core, first)
    second = create_draft(core, direct_vm, direct_alice, name="Second Org")
    add_two_sources(core, second)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(first)
    core.seal_organization(second)
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_web(r".*second-repo\.example.*", {"status": 200, "body": "Mission evidence 2030"})
    direct_vm.mock_web(r".*second-site\.example.*", {"status": 200, "body": "Mission evidence 2030"})

    warp(direct_vm, "2030-01-01T00:01:00Z")
    direct_vm.mock_llm(r"Assess mission continuity", response(1893456060, source_ids=(1, 2)))
    core.trigger_continuity_review(first)

    direct_vm.clear_mocks()
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_web(r".*second-repo\.example.*", {"status": 200, "body": "Mission evidence 2030"})
    direct_vm.mock_web(r".*second-site\.example.*", {"status": 200, "body": "Mission evidence 2030"})
    direct_vm.mock_llm(r"Assess mission continuity", response(1893456060, source_ids=(3, 4)))
    core.trigger_continuity_review(second)

    warp(direct_vm, "2030-01-01T00:02:00Z")
    direct_vm.clear_mocks()
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_llm(r"Assess mission continuity", response(1893456120, source_ids=(1, 2)))
    core.trigger_continuity_review(first)

    first_state = json.loads(core.get_organization(first))
    second_state = json.loads(core.get_organization(second))
    assert first_state["review_count"] == 2
    assert first_state["latest_review_id"] == 3
    assert second_state["review_count"] == 1
    assert second_state["latest_review_id"] == 2
    assert json.loads(core.get_review(first_state["latest_review_id"]))["organization_id"] == first
    assert json.loads(core.get_review(second_state["latest_review_id"]))["organization_id"] == second


@pytest.mark.parametrize(
    "url",
    [
        "https://user:password@example.com/source",
        "https://example.com/source?token=secret",
        "https://localhost/source",
        "https://10.0.0.1/source",
        "https://[::1]/source",
    ],
)
def test_source_urls_reject_credentials_secrets_and_private_hosts(direct_vm, direct_deploy, direct_alice, url):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice)
    with direct_vm.expect_revert():
        core.add_source(org_id, "Hostile", url, "repo")


def test_source_url_and_record_bounds_are_enforced(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    with direct_vm.expect_revert("invalid mission"):
        core.create_organization("Aevum Test", "too short", "too short", 60, 120, 3600, 1000, direct_alice, 60)
    org_id = create_draft(core, direct_vm, direct_alice)
    with direct_vm.expect_revert("invalid source URL"):
        core.add_source(org_id, "Repo", "https://" + ("a" * 600) + ".example/source", "repo")


def test_validator_rejects_independent_decision_disagreement(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice)
    add_two_sources(core, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    warp(direct_vm, "2030-01-01T00:02:00Z")
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_llm(r"Assess mission continuity", response(1893456120, recent=True))
    core.trigger_continuity_review(org_id)
    direct_vm.clear_mocks()
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_llm(r"Assess mission continuity", response(1893456120, recent=False))
    assert direct_vm.run_validator() is False


def test_bounded_retry_envelope_is_durable_and_does_not_increment_success_count(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice)
    add_two_sources(core, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    warp(direct_vm, "2030-01-01T00:02:00Z")
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_llm(r"Assess mission continuity", json.dumps({"unexpected": True}))
    core.trigger_continuity_review(org_id)
    review = json.loads(core.get_review(1))
    org = json.loads(core.get_organization(org_id))
    assert review["review_state"] == "RETRYABLE_ERROR"
    assert review["error_code"] == "LLM_MALFORMED"
    assert org["review_count"] == 0
    assert org["latest_review_id"] == 1
    assert org["status"] == "REVIEW_DUE"


def test_successful_retry_after_bounded_failure_is_a_new_finalized_review(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice)
    add_two_sources(core, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    warp(direct_vm, "2030-01-01T00:02:00Z")
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_llm(r"Assess mission continuity", json.dumps({"unexpected": True}))
    core.trigger_continuity_review(org_id)
    direct_vm.clear_mocks()
    configure_source_web(direct_vm, "Mission evidence 2030")
    direct_vm.mock_llm(r"Assess mission continuity", response(1893456120, recent=True))
    warp(direct_vm, "2030-01-01T00:03:00Z")
    core.trigger_continuity_review(org_id)
    org = json.loads(core.get_organization(org_id))
    assert org["review_count"] == 1
    assert org["latest_review_id"] == 2
    assert json.loads(core.get_review(2))["review_state"] == "FINALIZED"


def test_interrupted_review_recovery_is_delayed_and_durable(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, direct_alice)
    add_two_sources(core, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    state = json.loads(core.get_organization(org_id))
    state["status"] = "REVIEWING"
    state["pending_review_id"] = 77
    state["review_started_at"] = 1893456000
    core.organizations[org_id] = json.dumps(state, sort_keys=True, separators=(",", ":"))
    warp(direct_vm, "2030-01-01T00:04:59Z")
    with direct_vm.expect_revert("recovery delay"):
        core.recover_review(org_id)
    warp(direct_vm, "2030-01-01T00:05:00Z")
    core.recover_review(org_id)
    recovered = json.loads(core.get_organization(org_id))
    receipt = json.loads(core.get_review(77))
    assert recovered["status"] == "REVIEW_DUE"
    assert recovered["pending_review_id"] == 0
    assert receipt["error_code"] == "INTERRUPTED_REVIEW_RECOVERED"
    with direct_vm.expect_revert("no interrupted review"):
        core.recover_review(org_id)
