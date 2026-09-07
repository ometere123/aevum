import os
import pytest


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
