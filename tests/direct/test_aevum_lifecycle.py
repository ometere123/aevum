import json
import pytest


def warp(direct_vm, timestamp):
    direct_vm.warp(timestamp)
    # gltest's warp updates the next stdin payload; keep the already-loaded
    # module-global message context aligned for the current direct call too.
    import genlayer.gl as gl
    gl.message_raw["datetime"] = timestamp


def deploy_core(direct_deploy, direct_vm, alice):
    core = direct_deploy("contracts/aevum_core.py")
    direct_vm.sender = alice
    return core


def create_draft(core, direct_vm, name="Aevum Test", interval=60):
    return core.create_organization(name, "A public mission with measurable continuity evidence.", interval, 120, 3600, 1000)


def add_two_sources(core, direct_vm, org_id):
    core.add_source(org_id, "Repository", "https://github.com/aevum-test/repo", "repo")
    core.add_source(org_id, "Official site", "https://aevum-test.org/mission", "official_site")


def active_response():
    return json.dumps({"activity_outcome":"ACTIVE","successor_outcome":"NOT_APPLICABLE","selected_candidate_id":-1,"selected_candidate_address":"","source_support":[{"source_id":1,"available":True,"supports_recent_activity":True,"supports_mission_alignment":True,"excerpt":"Aevum mission update"},{"source_id":2,"available":True,"supports_recent_activity":True,"supports_mission_alignment":True,"excerpt":"Aevum mission update"}],"reason":"two independent mission updates"})


def dormant_response(candidate_id=-1, candidate_address=""):
    successor = "ELIGIBLE" if candidate_id > 0 else "NOT_APPLICABLE"
    return json.dumps({"activity_outcome":"DORMANT","successor_outcome":successor,"selected_candidate_id":candidate_id,"selected_candidate_address":candidate_address,"source_support":[{"source_id":1,"available":True,"supports_recent_activity":False,"supports_mission_alignment":False,"excerpt":"Aevum archive"},{"source_id":2,"available":True,"supports_recent_activity":False,"supports_mission_alignment":False,"excerpt":"Aevum archive"}],"reason":"no recent mission activity"})


def configure_web(direct_vm, body="Aevum mission update"):
    direct_vm.mock_web(r".*github\.com.*", {"status":200,"body":body})
    direct_vm.mock_web(r".*aevum-test\.org.*", {"status":200,"body":body})


def test_create_invalid_charter_and_source_bounds(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    with direct_vm.expect_revert("invalid organization name"):
        core.create_organization("x", "A public mission with measurable continuity evidence.", 60, 120, 3600, 1000)
    org_id = create_draft(core, direct_vm)
    with direct_vm.expect_revert("invalid source URL"):
        core.add_source(org_id, "Bad", "http://not-secure.example", "repo")
    core.add_source(org_id, "One", "https://one.example/a", "repo")
    with direct_vm.expect_revert("duplicate source origin"):
        core.add_source(org_id, "One again", "https://one.example/b", "official_site")


def test_seal_requires_independent_sources_and_freezes_charter(direct_vm, direct_deploy, direct_alice, direct_bob):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm)
    core.add_source(org_id, "Only", "https://one.example/a", "repo")
    with direct_vm.expect_revert("at least two sources"):
        core.seal_organization(org_id)
    core.add_source(org_id, "Second", "https://two.example/a", "official_site")
    core.seal_organization(org_id)
    sealed = json.loads(core.get_organization(org_id))
    assert sealed["sealed"] is True and sealed["status"] == "ACTIVE"
    definition_hash = core.current_definition_hash(org_id)
    with direct_vm.prank(direct_bob):
        with direct_vm.expect_revert("only creator"):
            core.add_source(org_id, "Third", "https://three.example/a", "governance")
    assert core.current_definition_hash(org_id) == definition_hash


def test_active_review_re_fetches_and_validator_agrees(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm)
    add_two_sources(core, direct_vm, org_id)
    core.seal_organization(org_id)
    warp(direct_vm, "2030-01-01T00:02:00Z")
    configure_web(direct_vm)
    direct_vm.mock_llm(r"Evaluate continuity", active_response())
    core.trigger_continuity_review(org_id)
    assert direct_vm.run_validator() is True
    org = json.loads(core.get_organization(org_id))
    assert org["status"] == "ACTIVE" and org["spending_enabled"] is True
    assert org["last_outcome"] == "ACTIVE"


def test_insufficient_evidence_is_durable_and_preserves_steward(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm)
    add_two_sources(core, direct_vm, org_id)
    core.seal_organization(org_id)
    original = core.current_steward(org_id)
    warp(direct_vm, "2030-01-01T00:02:00Z")
    configure_web(direct_vm, "")
    response = {"activity_outcome":"INSUFFICIENT_EVIDENCE","successor_outcome":"INSUFFICIENT_EVIDENCE","selected_candidate_id":-1,"selected_candidate_address":"","source_support":[{"source_id":1,"available":False,"supports_recent_activity":False,"supports_mission_alignment":False,"excerpt":""},{"source_id":2,"available":False,"supports_recent_activity":False,"supports_mission_alignment":False,"excerpt":""}],"reason":"sources unavailable"}
    direct_vm.mock_llm(r"Evaluate continuity", json.dumps(response))
    core.trigger_continuity_review(org_id)
    org = json.loads(core.get_organization(org_id))
    assert org["last_outcome"] == "INSUFFICIENT_EVIDENCE"
    assert org["current_steward"] == original and org["spending_enabled"] is True


def test_malformed_model_output_cannot_override_deterministic_projection(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm)
    add_two_sources(core, direct_vm, org_id)
    core.seal_organization(org_id)
    warp(direct_vm, "2030-01-01T00:02:00Z")
    configure_web(direct_vm)
    direct_vm.mock_llm(r"Evaluate continuity", json.dumps({"activity_outcome":"ACTIVE","successor_outcome":"NOT_APPLICABLE","source_support":[],"reason":"bad"}))
    core.trigger_continuity_review(org_id)
    org = json.loads(core.get_organization(org_id))
    assert org["status"] == "ACTIVE" and org["pending_review_id"] == 0
    assert org["last_outcome"] == "ACTIVE"


def test_candidate_specific_selection_is_not_first_active_candidate(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm)
    add_two_sources(core, direct_vm, org_id)
    core.seal_organization(org_id)
    with direct_vm.prank(direct_bob):
        first = core.nominate_successor(org_id, direct_bob, "https://bob.example/manifesto")
    with direct_vm.prank(direct_charlie):
        second = core.nominate_successor(org_id, direct_charlie, "https://charlie.example/manifesto")
    assert first == 1 and second == 2
    warp(direct_vm, "2030-01-01T00:02:00Z")
    configure_web(direct_vm, "Aevum archive")
    from genlayer import Address
    direct_vm.mock_llm(r"Evaluate continuity", dormant_response(2, str(Address(direct_charlie)).lower()))
    core.trigger_continuity_review(org_id)
    assert direct_vm.run_validator() is True
    assert core.current_steward(org_id) == str(Address(direct_charlie)).lower()
    receipt = json.loads(core.get_review(1))
    assert receipt["selected_candidate_id"] == 2 and receipt["transition_applied"] is True


def test_duplicate_review_and_deadline_boundary(direct_vm, direct_deploy, direct_alice):
    core = deploy_core(direct_deploy, direct_vm, direct_alice)
    org_id = create_draft(core, direct_vm, interval=100)
    add_two_sources(core, direct_vm, org_id)
    warp(direct_vm, "2030-01-01T00:00:00Z")
    core.seal_organization(org_id)
    warp(direct_vm, "2030-01-01T00:01:39Z")
    assert core.is_review_due(org_id) is False
    with direct_vm.expect_revert("not due"):
        core.trigger_continuity_review(org_id)
    warp(direct_vm, "2030-01-01T00:01:40Z")
    configure_web(direct_vm)
    direct_vm.mock_llm(r"Evaluate continuity", active_response())
    core.trigger_continuity_review(org_id)
    assert core.is_review_due(org_id) is False


def test_vault_rejects_invalid_core_address(direct_vm, direct_deploy):
    with direct_vm.expect_revert("invalid Core contract address"):
        direct_deploy("contracts/aevum_vault.py", "0x000000000000000000000000000000000000000")
