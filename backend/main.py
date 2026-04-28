"""Root-level FastAPI entrypoint for deployment."""
import os
import sys

_SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from shukatsu_backend.main import app  # noqa: E402

__all__ = ["app"]
