import json
import pytest
from genlayer import Address


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


def response(review_time, recent=True, breach=False, contradictory=False, candidates=None):
    candidates = candidates or []
    latest = review_time - 30 if recent else review_time - 1000
    return json.dumps(
        {
            "sources": [
                {
                    "source_id": 1,
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
                    "source_id": 2,
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
    assert org["current_steward"] == str(Address(direct_alice)).lower()


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
    assert core.current_steward(org_id) == str(Address(direct_bob)).lower()
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
