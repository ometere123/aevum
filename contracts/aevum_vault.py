# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json
from datetime import datetime, timezone


@gl.contract_interface
class CoreInterface:
    class View:
        def get_organization(self, org_id: u256) -> str: ...
        def current_steward(self, org_id: u256) -> Address: ...
        def is_spending_enabled(self, org_id: u256) -> bool: ...
        def get_treasury_policy(self, org_id: u256) -> str: ...
    class Write:
        def record_treasury_balance(self, org_id: u256, balance: u256): ...


@gl.evm.contract_interface
class Recipient:
    class View:
        pass
    class Write:
        pass


class AevumVault(gl.Contract):
    core_address: Address
    funded: TreeMap[u256, u256]
    released: TreeMap[u256, u256]
    epoch_start: TreeMap[u256, u256]
    epoch_spent: TreeMap[u256, u256]
    used_releases: TreeMap[str, bool]

    def __init__(self, core_address):
        address = str(Address(core_address)) if isinstance(core_address, (bytes, bytearray)) else str(core_address)
        if len(address) != 42 or not address.startswith("0x"):
            raise gl.vm.UserError("[EXPECTED] invalid Core contract address")
        if address.lower() == "0x0000000000000000000000000000000000000000":
            raise gl.vm.UserError("[EXPECTED] invalid Core contract address")
        self.core_address = Address(address)

    def _require(self, condition, message):
        if not condition:
            raise gl.vm.UserError(message)

    def _now(self):
        raw = gl.message_raw.get("datetime") if gl.message_raw else None
        self._require(isinstance(raw, str) and raw, "[EXPECTED] transaction timestamp unavailable")
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            self._require(parsed.tzinfo is not None, "[EXPECTED] transaction timestamp must include timezone")
            return u256(int(parsed.timestamp()))
        except Exception:
            raise gl.vm.UserError("[EXPECTED] invalid transaction timestamp")

    def _core(self):
        return CoreInterface(self.core_address)

    def _sync_core_balance(self, org_id, balance):
        self._core().emit(on="finalized").record_treasury_balance(org_id, u256(balance))

    def _org(self, org_id):
        try:
            return json.loads(self._core().view().get_organization(org_id))
        except Exception:
            raise gl.vm.UserError("[EXPECTED] organization not found")

    @gl.public.write.payable
    def deposit(self, org_id):
        org = self._org(org_id)
        self._require(org["sealed"] and org["status"] not in ["CLOSED", "DORMANT", "SUCCESSOR_TRANSITION"], "[EXPECTED] organization is not depositable")
        self._require(gl.message.value > 0, "[EXPECTED] deposit must be positive")
        self.funded[org_id] = self.funded.get(org_id, u256(0)) + gl.message.value
        self._sync_core_balance(org_id, self.funded[org_id] - self.released.get(org_id, u256(0)))

    @gl.public.write
    def release(self, org_id, recipient, amount, memo_hash):
        org = self._org(org_id)
        self._require(org["sealed"] and org["status"] not in ["DORMANT", "CLOSED", "SUCCESSOR_TRANSITION"], "[EXPECTED] organization cannot release")
        self._require(self._core().view().is_spending_enabled(org_id), "[EXPECTED] Core spending permission disabled")
        self._require(gl.message.sender_address == self._core().view().current_steward(org_id), "[EXPECTED] caller is not current steward")
        recipient_address = str(Address(recipient)) if isinstance(recipient, (bytes, bytearray)) else str(recipient)
        self._require(len(recipient_address) == 42 and recipient_address.startswith("0x") and recipient_address.lower() != "0x0000000000000000000000000000000000000000", "[EXPECTED] invalid recipient")
        self._require(amount > 0, "[EXPECTED] release must be positive")
        memo = str(memo_hash).lower()
        self._require(len(memo) == 66 and memo.startswith("0x"), "[EXPECTED] memo hash must be bytes32")
        self._require(not self.used_releases.get(memo, False), "[EXPECTED] release already used")
        funded = self.funded.get(org_id, u256(0))
        released = self.released.get(org_id, u256(0))
        self._require(released + amount <= funded, "[EXPECTED] release exceeds solvency")
        policy = json.loads(self._core().view().get_treasury_policy(org_id))
        now = self._now()
        start = self.epoch_start.get(org_id, u256(0))
        spent = self.epoch_spent.get(org_id, u256(0))
        if start == 0:
            start = now
        elif now >= start + u256(policy["epoch_seconds"]):
            start, spent = now, u256(0)
        self._require(spent + amount <= u256(policy["release_cap"]), "[EXPECTED] epoch cap exceeded")
        self.epoch_start[org_id] = start
        self.epoch_spent[org_id] = spent + amount
        self.released[org_id] = released + amount
        self.used_releases[memo] = True
        self._sync_core_balance(org_id, self.funded[org_id] - self.released[org_id])
        Recipient(Address(recipient_address)).emit_transfer(value=u256(amount), on="finalized")

    @gl.public.view
    def get_vault(self, org_id):
        funded = self.funded.get(org_id, u256(0)); released = self.released.get(org_id, u256(0)); start = self.epoch_start.get(org_id, u256(0)); spent = self.epoch_spent.get(org_id, u256(0))
        return json.dumps({"org_id": int(org_id), "funded": int(funded), "released": int(released), "balance": int(funded - released), "epoch_start": int(start), "epoch_spent": int(spent)}, sort_keys=True)

    @gl.public.view
    def remaining_epoch_allowance(self, org_id):
        policy = json.loads(self._core().view().get_treasury_policy(org_id)); cap = u256(policy["release_cap"]); spent = self.epoch_spent.get(org_id, u256(0)); return int(cap - spent) if spent < cap else 0

    @gl.public.view
    def was_release_used(self, release_hash): return self.used_releases.get(str(release_hash).lower(), False)
