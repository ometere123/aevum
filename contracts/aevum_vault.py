# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import hashlib
import json
from datetime import datetime


@gl.contract_interface
class CoreInterface:
    class View:
        def get_organization(self, org_id: u256) -> str: ...
        def current_steward(self, org_id: u256) -> Address: ...
        def is_spending_enabled(self, org_id: u256) -> bool: ...
        def get_treasury_policy(self, org_id: u256) -> str: ...
        def get_recovery_policy(self, org_id: u256) -> str: ...
        def can_recover_treasury(self, org_id: u256) -> bool: ...


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
    recovered: TreeMap[u256, u256]
    epoch_start: TreeMap[u256, u256]
    epoch_spent: TreeMap[u256, u256]
    used_releases: TreeMap[str, bool]
    recovery_used: TreeMap[u256, bool]

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

    def _org(self, org_id):
        try:
            return json.loads(self._core().view().get_organization(org_id))
        except Exception:
            raise gl.vm.UserError("[EXPECTED] organization not found")

    def _balance(self, org_id):
        funded = self.funded.get(org_id, u256(0))
        released = self.released.get(org_id, u256(0))
        recovered = self.recovered.get(org_id, u256(0))
        self._require(released + recovered <= funded, "[EXPECTED] vault accounting corrupted")
        return funded - released - recovered

    def _memo(self, memo_hash):
        memo = str(memo_hash).lower()
        self._require(len(memo) == 66 and memo.startswith("0x"), "[EXPECTED] memo hash must be bytes32")
        self._require(all(ch in "0123456789abcdef" for ch in memo[2:]), "[EXPECTED] memo hash must be lowercase hex")
        return memo

    def _release_key(self, org_id, memo):
        return hashlib.sha256((str(int(org_id)) + ":" + memo).encode("utf-8")).hexdigest()

    @gl.public.write.payable
    def deposit(self, org_id):
        org = self._org(org_id)
        self._require(
            org["sealed"] and org["status"] in ["ACTIVE", "REVIEW_DUE"],
            "[EXPECTED] organization is not depositable",
        )
        self._require(gl.message.value > 0, "[EXPECTED] deposit must be positive")
        self.funded[org_id] = self.funded.get(org_id, u256(0)) + gl.message.value

    @gl.public.write
    def release(self, org_id, recipient, amount, memo_hash):
        org = self._org(org_id)
        self._require(org["sealed"] and org["status"] == "ACTIVE", "[EXPECTED] organization cannot release")
        self._require(self._core().view().is_spending_enabled(org_id), "[EXPECTED] Core spending permission disabled")
        self._require(
            str(gl.message.sender_address).lower() == str(self._core().view().current_steward(org_id)).lower(),
            "[EXPECTED] caller is not current steward",
        )
        recipient_address = str(Address(recipient)) if isinstance(recipient, (bytes, bytearray)) else str(recipient)
        self._require(
            len(recipient_address) == 42
            and recipient_address.startswith("0x")
            and recipient_address.lower() != "0x0000000000000000000000000000000000000000",
            "[EXPECTED] invalid recipient",
        )
        amount = u256(amount)
        self._require(amount > 0, "[EXPECTED] release must be positive")
        memo = self._memo(memo_hash)
        release_key = self._release_key(org_id, memo)
        self._require(not self.used_releases.get(release_key, False), "[EXPECTED] release already used")
        self._require(amount <= self._balance(org_id), "[EXPECTED] release exceeds solvency")

        policy = json.loads(self._core().view().get_treasury_policy(org_id))
        now = self._now()
        start = self.epoch_start.get(org_id, u256(0))
        spent = self.epoch_spent.get(org_id, u256(0))
        if start == 0:
            start = now
            spent = u256(0)
        elif now >= start + u256(policy["epoch_seconds"]):
            start = now
            spent = u256(0)
        self._require(spent + amount <= u256(policy["release_cap"]), "[EXPECTED] epoch cap exceeded")

        self.epoch_start[org_id] = start
        self.epoch_spent[org_id] = spent + amount
        self.released[org_id] = self.released.get(org_id, u256(0)) + amount
        self.used_releases[release_key] = True
        Recipient(Address(recipient_address)).emit_transfer(value=amount, on="finalized")

    @gl.public.write
    def recover_dormant(self, org_id):
        self._require(self._core().view().can_recover_treasury(org_id), "[EXPECTED] treasury recovery unavailable")
        self._require(not self.recovery_used.get(org_id, False), "[EXPECTED] treasury already recovered")
        amount = self._balance(org_id)
        self._require(amount > 0, "[EXPECTED] treasury is already clear")
        policy = json.loads(self._core().view().get_recovery_policy(org_id))
        recipient = str(policy["recovery_recipient"])
        self._require(
            len(recipient) == 42 and recipient.startswith("0x") and recipient.lower() != "0x0000000000000000000000000000000000000000",
            "[EXPECTED] invalid recovery recipient",
        )
        self.recovered[org_id] = self.recovered.get(org_id, u256(0)) + amount
        self.recovery_used[org_id] = True
        Recipient(Address(recipient)).emit_transfer(value=amount, on="finalized")

    @gl.public.view
    def get_vault(self, org_id) -> str:
        funded = self.funded.get(org_id, u256(0))
        released = self.released.get(org_id, u256(0))
        recovered = self.recovered.get(org_id, u256(0))
        start = self.epoch_start.get(org_id, u256(0))
        spent = self.epoch_spent.get(org_id, u256(0))
        return json.dumps(
            {
                "org_id": int(org_id),
                "funded": str(int(funded)),
                "released": str(int(released)),
                "recovered": str(int(recovered)),
                "balance": str(int(self._balance(org_id))),
                "epoch_start": int(start),
                "epoch_spent": str(int(spent)),
            },
            sort_keys=True,
        )

    @gl.public.view
    def remaining_epoch_allowance(self, org_id) -> int:
        policy = json.loads(self._core().view().get_treasury_policy(org_id))
        cap = u256(policy["release_cap"])
        start = self.epoch_start.get(org_id, u256(0))
        spent = self.epoch_spent.get(org_id, u256(0))
        now = self._now()
        if start == 0 or now >= start + u256(policy["epoch_seconds"]):
            return int(cap)
        return int(cap - spent) if spent < cap else 0

    @gl.public.view
    def was_release_used(self, org_id, memo_hash) -> bool:
        memo = self._memo(memo_hash)
        return self.used_releases.get(self._release_key(org_id, memo), False)

    @gl.public.view
    def get_core_address(self) -> str:
        return str(self.core_address)
