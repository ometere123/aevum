import os
from pathlib import Path
import pytest
from gltest.direct import deploy_contract


# Pin the direct runner because genlayer-test's dynamic latest-release lookup
# can select a GitHub tag that is not published for the required universal
# runner. This is the same compatible GenVM release used by the local harness.
DIRECT_SDK_VERSION = "v0.2.16"


@pytest.fixture(autouse=True)
def tolerate_windows_direct_vm_temp_cleanup(monkeypatch):
    """The bundled direct runner unlinks redirected stdin before releasing it on Windows."""
    original = os.unlink

    def safe_unlink(path, *args, **kwargs):
        try:
            return original(path, *args, **kwargs)
        except PermissionError:
            return None

    monkeypatch.setattr(os, "unlink", safe_unlink)


@pytest.fixture
def direct_deploy(direct_vm):
    def _deploy(contract_path, *args, **kwargs):
        path = Path(contract_path)
        if not path.is_absolute():
            path = (Path.cwd() / path).resolve()
        return deploy_contract(path, direct_vm, *args, sdk_version=DIRECT_SDK_VERSION, **kwargs)

    return _deploy
