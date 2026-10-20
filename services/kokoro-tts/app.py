"""
Kokoro-82M TTS HTTP service for Dear Creative publish-time narration.
Auth: Authorization: Bearer <KOKORO_TTS_TOKEN> (constant-time compare).
"""
from __future__ import annotations

import hmac
import io
import os
import threading
from typing import Annotated, Literal

import numpy as np
import soundfile as sf
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

DEFAULT_VOICE = os.environ.get("KOKORO_DEFAULT_VOICE", "af_heart")
LANG_CODE = os.environ.get("KOKORO_LANG_CODE", "a")
MAX_TEXT_CHARS = int(os.environ.get("KOKORO_MAX_TEXT_CHARS", "4000"))

ALLOWED_VOICES = frozenset({"af_heart"})

app = FastAPI(title="Dear Creative Kokoro TTS", version="1.0.0")

_pipeline_lock = threading.Lock()
_pipeline = None


def _expected_token() -> str:
    token = os.environ.get("KOKORO_TTS_TOKEN", "").strip()
    if not token:
        raise HTTPException(status_code=503, detail="KOKORO_TTS_TOKEN is not configured")
    return token


def verify_bearer(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    expected = _expected_token()
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    provided = authorization[7:].strip()
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        with _pipeline_lock:
            if _pipeline is None:
                from kokoro import KPipeline

                _pipeline = KPipeline(lang_code=LANG_CODE)
    return _pipeline


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)
    voice: str = DEFAULT_VOICE
    format: Literal["wav"] = "wav"


def _synthesize_numpy(text: str, voice: str) -> np.ndarray:
    if voice not in ALLOWED_VOICES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported voice {voice!r}; allowed: {sorted(ALLOWED_VOICES)}",
        )
    pipeline = get_pipeline()
    chunks: list[np.ndarray] = []
    generator = pipeline(text, voice=voice, speed=1)
    for _gs, _ps, audio in generator:
        if audio is None or len(audio) == 0:
            continue
        chunks.append(np.asarray(audio, dtype=np.float32))
    if not chunks:
        raise HTTPException(status_code=422, detail="No audio generated for text")
    return np.concatenate(chunks)


def _float32_to_wav(audio: np.ndarray, sample_rate: int = 24000) -> bytes:
    clipped = np.clip(audio, -1.0, 1.0)
    buf = io.BytesIO()
    sf.write(buf, clipped, sample_rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/synthesize")
def synthesize(
    body: SynthesizeRequest,
    _: Annotated[None, Depends(verify_bearer)] = None,
) -> Response:
    clean = " ".join(body.text.split())
    if len(clean) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Text exceeds {MAX_TEXT_CHARS} characters; split on the caller.",
        )

    voice = body.voice.strip() or DEFAULT_VOICE
    audio = _synthesize_numpy(clean, voice)
    wav_bytes = _float32_to_wav(audio)
    return Response(content=wav_bytes, media_type="audio/wav")
