# v0.2.18
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from datetime import datetime, timezone

@gl.contract_interface
class CoreInterface:
    def get_organization(self, org_id): pass
    def current_steward(self, org_id): pass
    def is_spending_enabled(self, org_id): pass
    def get_treasury_policy(self, org_id): pass

class AevumVault(gl.Contract):
    def __init__(self, core_address):
        self.core_address=core_address; self.funded=TreeMap(); self.released=TreeMap(); self.epoch_start=TreeMap(); self.epoch_spent=TreeMap(); self.used_releases=TreeMap()
    def _now(self): return int(datetime.now(timezone.utc).timestamp())
    def _core(self): return CoreInterface(self.core_address)
    @gl.public.payable
    def deposit(self, org_id):
        org=self._core().get_organization(org_id); assert org["sealed"] and org["status"] != "CLOSED" and gl.message.value > 0
        self.funded[org_id]=self.funded.get(org_id,0)+gl.message.value
    @gl.public.write
    def release(self, org_id, recipient, amount, memo_hash):
        org=self._core().get_organization(org_id); assert org["sealed"] and self._core().is_spending_enabled(org_id); assert str(gl.message.sender)==self._core().current_steward(org_id); assert amount>0 and recipient
        assert not self.used_releases.get(memo_hash,False); funded=self.funded.get(org_id,0); released=self.released.get(org_id,0); assert released+amount<=funded
        policy=self._core().get_treasury_policy(org_id); now=self._now(); start=self.epoch_start.get(org_id,now); spent=self.epoch_spent.get(org_id,0)
        if now>=start+policy["epoch_seconds"]: start=now; spent=0
        assert spent+amount<=policy["release_cap"]
        self.epoch_start[org_id]=start; self.epoch_spent[org_id]=spent+amount; self.released[org_id]=released+amount; self.used_releases[memo_hash]=True
        gl.message.send(recipient, amount)
    @gl.public.view
    def get_vault(self, org_id): return {"org_id":org_id,"funded":self.funded.get(org_id,0),"released":self.released.get(org_id,0),"epoch_start":self.epoch_start.get(org_id,0),"epoch_spent":self.epoch_spent.get(org_id,0)}
    @gl.public.view
    def remaining_epoch_allowance(self, org_id):
        policy=self._core().get_treasury_policy(org_id); return max(0,policy["release_cap"]-self.epoch_spent.get(org_id,0))
    @gl.public.view
    def was_release_used(self, release_hash): return self.used_releases.get(release_hash,False)
