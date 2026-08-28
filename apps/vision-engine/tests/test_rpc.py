from pathlib import Path

import pytest

from design_acceptance_vision.rpc import dispatch


def test_rpc_reports_capabilities_and_blocks_unknown_methods(tmp_path: Path) -> None:
    capabilities = dispatch(tmp_path, "capabilities", {})
    assert capabilities["engine_version"] == "0.0.1"
    assert "available" in capabilities["ocr"]
    with pytest.raises(ValueError, match="METHOD_NOT_FOUND"):
        dispatch(tmp_path, "shell", {})
