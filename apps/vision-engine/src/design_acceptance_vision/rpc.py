from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from .io import safe_path, stitch_segments
from .pipeline import analyze
from . import __version__


def dispatch(root: Path, method: str, params: dict[str, Any]) -> object:
    if method == "ping":
        return {"status": "ok"}
    if method == "capabilities":
        os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
        try:
            import paddle  # type: ignore[import-not-found]
            import paddleocr  # type: ignore[import-not-found]
            ocr = {"available": True, "paddle": paddle.__version__, "paddleocr": paddleocr.__version__}
        except ImportError:
            ocr = {"available": False}
        return {"engine_version": __version__, "ocr": ocr}
    if method == "stitch":
        manifest = safe_path(root, params["manifest_path"])
        output = safe_path(root, params["output_path"], must_exist=False)
        return stitch_segments(manifest, output, int(params["page_width"]), int(params["page_height"]), float(params["dpr"]))
    if method == "analyze":
        reference = safe_path(root, params["reference_path"])
        candidate = safe_path(root, params["candidate_path"])
        evidence = safe_path(root, params["evidence_path"], must_exist=False)
        rules = params.get("rules")
        if rules is not None and not isinstance(rules, dict):
            raise ValueError("INVALID_RULES")
        use_ocr = params.get("use_ocr", False)
        if not isinstance(use_ocr, bool):
            raise ValueError("INVALID_OCR_FLAG")
        return analyze(reference, candidate, evidence, rules, use_ocr)
    raise ValueError("METHOD_NOT_FOUND")


def serve(root: Path) -> None:
    for line in sys.stdin:
        request: object = None
        try:
            request = json.loads(line)
            if not isinstance(request, dict) or request.get("jsonrpc") != "2.0" or "id" not in request:
                raise ValueError("INVALID_REQUEST")
            params = request.get("params", {})
            if not isinstance(params, dict):
                raise ValueError("INVALID_PARAMS")
            result = dispatch(root, str(request.get("method", "")), params)
            response = {"jsonrpc": "2.0", "id": request["id"], "result": result}
        except Exception as error:
            request_id = request.get("id") if isinstance(request, dict) else None
            response = {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32000, "message": str(error)}}
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", required=True, type=Path)
    arguments = parser.parse_args()
    serve(arguments.data_root.resolve())


if __name__ == "__main__":
    main()
