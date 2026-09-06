from pathlib import Path
CORE=Path("contracts/aevum_core.py").read_text()
VAULT=Path("contracts/aevum_vault.py").read_text()
def test_core_has_frozen_charter_and_bounded_sources():
    assert "MIN_SOURCES <= org[\"source_count\"]" in CORE
    assert "org[\"sealed\"]" in CORE and "definition_hash" in CORE
    assert "https://" in CORE and "MAX_SOURCES" in CORE
def test_core_has_substantive_validator():
    assert "_validate_consensus" in CORE and "supports_recent_activity" in CORE
    assert "source_support" in CORE and "excerpt" in CORE
def test_fail_closed_and_successor_gate():
    assert "INSUFFICIENT_EVIDENCE" in CORE and "successor==\"ELIGIBLE\"" in CORE
    assert "spending_enabled" in CORE and "DORMANT" in CORE
def test_vault_composition_and_conservation():
    assert "@gl.contract_interface" in VAULT
    assert "released+amount<=funded" in VAULT and "spent+amount<=policy[\"release_cap\"]" in VAULT
    assert "used_releases" in VAULT and "gl.message.send" in VAULT
