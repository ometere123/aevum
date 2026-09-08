import json
import pytest

from genlayer_py.abi import calldata


CORE_ADDRESS = "0x" + "11" * 20
ALICE = "0x" + "22" * 20
BOB = "0x" + "33" * 20
MEMO = "0x" + "aa" * 32


def make_core_hook(steward, status="ACTIVE", can_recover=False, release_cap=2_000_000_000_000_000_000):
  steward_address = "0x" + bytes(steward).hex()
  def core_hook(_vm, request):
    call = request.get("CallContract")
    if not call:
        return None
    method = call.get("calldata", {}).get("method")
    org = {
        "sealed": True,
        "status": status,
        "current_steward": steward_address,
        "recovery_recipient": BOB,
        "release_cap": release_cap,
        "epoch_seconds": 3600,
    }
    if method == "get_organization":
        return bytes([0]) + calldata.encode(json.dumps(org, sort_keys=True))
    if method == "is_spending_enabled":
        return bytes([0]) + calldata.encode(True)
    if method == "current_steward":
        return bytes([0]) + calldata.encode(steward_address)
    if method == "get_treasury_policy":
        return bytes([0]) + calldata.encode(json.dumps({"release_cap": org["release_cap"], "epoch_seconds": 3600}))
    if method == "get_recovery_policy":
        return bytes([0]) + calldata.encode(json.dumps({"recovery_recipient": BOB}))
    if method == "can_recover_treasury":
        return bytes([0]) + calldata.encode(can_recover)
    return None
  return core_hook


def deploy_vault(direct_vm, direct_deploy, steward, status="ACTIVE", can_recover=False, release_cap=2_000_000_000_000_000_000):
    direct_vm._gl_call_hook = make_core_hook(steward, status, can_recover, release_cap)
    return direct_deploy("contracts/aevum_vault.py", CORE_ADDRESS)


def test_deposit_exact_value_and_conservation(direct_vm, direct_deploy, direct_alice, direct_bob):
    vault = deploy_vault(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = 1_000_000_000_000_000_000
    vault.deposit(1)
    direct_vm.sender = direct_bob
    direct_vm.value = 250_000_000_000_000_000
    vault.deposit(1)
    state = json.loads(vault.get_vault(1))
    assert int(state["funded"]) == 1_250_000_000_000_000_000
    assert int(state["released"]) == 0
    assert int(state["recovered"]) == 0
    assert int(state["balance"]) == int(state["funded"]) - int(state["released"]) - int(state["recovered"])


def test_zero_deposit_rejected(direct_vm, direct_deploy, direct_alice):
    vault = deploy_vault(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("deposit must be positive"):
        vault.deposit(1)


def test_release_is_exact_once_and_updates_before_transfer(direct_vm, direct_deploy, direct_alice):
    vault = deploy_vault(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = 1_000_000_000_000_000_000
    vault.deposit(1)
    vault.release(1, BOB, 125_000_000_000_000_000, MEMO)
    state = json.loads(vault.get_vault(1))
    assert int(state["released"]) == 125_000_000_000_000_000
    assert int(state["balance"]) == 875_000_000_000_000_000
    assert vault.was_release_used(1, MEMO) is True
    with direct_vm.expect_revert("release already used"):
        vault.release(1, BOB, 125_000_000_000_000_000, MEMO)


def test_release_rejects_wrong_steward_and_overdraft(direct_vm, direct_deploy, direct_alice, direct_bob):
    vault = deploy_vault(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    vault.deposit(1)
    with direct_vm.prank(direct_bob):
        with direct_vm.expect_revert("caller is not current steward"):
            vault.release(1, BOB, 1, MEMO)
    with direct_vm.expect_revert("release exceeds solvency"):
        vault.release(1, BOB, 101, MEMO)


def test_maximum_funding_is_safe_and_second_deposit_overflows(direct_vm, direct_deploy, direct_alice):
    vault = deploy_vault(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = (1 << 256) - 1
    vault.deposit(1)
    state = json.loads(vault.get_vault(1))
    assert int(state["funded"]) == (1 << 256) - 1
    direct_vm.value = 1
    with direct_vm.expect_revert("funded overflow"):
        vault.deposit(1)


def test_same_memo_isolated_between_organizations(direct_vm, direct_deploy, direct_alice):
    vault = deploy_vault(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    vault.deposit(1)
    direct_vm.value = 100
    vault.deposit(2)
    vault.release(1, BOB, 40, MEMO)
    assert vault.was_release_used(1, MEMO) is True
    assert vault.was_release_used(2, MEMO) is False
    vault.release(2, BOB, 40, MEMO)
    assert vault.was_release_used(2, MEMO) is True
    assert int(json.loads(vault.get_vault(1))["balance"]) == 60
    assert int(json.loads(vault.get_vault(2))["balance"]) == 60


def test_maximum_release_is_conserved_and_replay_safe(direct_vm, direct_deploy, direct_alice):
    vault = deploy_vault(direct_vm, direct_deploy, direct_alice, release_cap=(1 << 256) - 1)
    direct_vm.sender = direct_alice
    direct_vm.value = (1 << 256) - 1
    vault.deposit(1)
    vault.release(1, BOB, (1 << 256) - 1, MEMO)
    state = json.loads(vault.get_vault(1))
    assert int(state["released"]) == (1 << 256) - 1
    assert int(state["balance"]) == 0
    with direct_vm.expect_revert("release already used"):
        vault.release(1, BOB, 1, MEMO)


def test_maximum_recovery_is_conserved_and_replay_safe(direct_vm, direct_deploy, direct_alice):
    vault = deploy_vault(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = (1 << 256) - 1
    vault.deposit(1)
    direct_vm._gl_call_hook = make_core_hook(direct_alice, "DORMANT", True)
    vault.recover_dormant(1)
    state = json.loads(vault.get_vault(1))
    assert int(state["recovered"]) == (1 << 256) - 1
    assert int(state["balance"]) == 0
    with direct_vm.expect_revert("treasury already recovered"):
        vault.recover_dormant(1)
