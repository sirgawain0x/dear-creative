"""Bake Kokoro model + af_heart voice into the image layer (build-time only)."""
from __future__ import annotations

import os

os.environ.setdefault("HF_HOME", "/app/.cache/huggingface")

from kokoro import KPipeline  # noqa: E402

pipeline = KPipeline(lang_code="a")

if hasattr(pipeline, "load_voice"):
    pipeline.load_voice("af_heart")
else:
    # Warm the voice tensor via a minimal synthesis pass.
    next(iter(pipeline(" ", voice="af_heart")))

print("Kokoro weights and af_heart voice cached.")
