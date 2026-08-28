from design_acceptance_vision.ocr import OcrLine, compare_text


def test_text_comparison_uses_nearest_line() -> None:
    issues = compare_text(
        [OcrLine("提交订单", 0.99, (10, 10, 80, 24))],
        [OcrLine("确认订单", 0.98, (11, 10, 80, 24))],
    )
    assert issues == [{"type": "text", "expected": "提交订单", "actual": "确认订单", "box": (11, 10, 80, 24), "confidence": "high"}]
