"""Bearer auth tests for Kokoro TTS (no model load)."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Configure token before importing app (module reads env at request time).
os.environ["KOKORO_TTS_TOKEN"] = "test-secret-token-for-unit-tests"

from app import app  # noqa: E402

client = TestClient(app)


def test_synthesize_without_token_returns_401() -> None:
    response = client.post(
        "/v1/synthesize",
        json={"text": "Hello.", "voice": "af_heart", "format": "wav"},
    )
    assert response.status_code == 401


def test_synthesize_with_wrong_token_returns_401() -> None:
    response = client.post(
        "/v1/synthesize",
        json={"text": "Hello.", "voice": "af_heart", "format": "wav"},
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert response.status_code == 401


def test_synthesize_with_missing_bearer_prefix_returns_401() -> None:
    response = client.post(
        "/v1/synthesize",
        json={"text": "Hello.", "voice": "af_heart", "format": "wav"},
        headers={"Authorization": "test-secret-token-for-unit-tests"},
    )
    assert response.status_code == 401


def test_healthz_is_public() -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
