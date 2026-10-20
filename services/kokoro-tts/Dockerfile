# Kokoro-82M on CPU for publish-time narration (weights baked at build time).
FROM python:3.11-slim-bookworm AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends espeak-ng \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV HF_HOME=/app/.cache/huggingface \
    KOKORO_DEFAULT_VOICE=af_heart \
    KOKORO_LANG_CODE=a \
    KOKORO_MAX_TEXT_CHARS=4000 \
    PORT=8080

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bake_kokoro_weights.py app.py ./
RUN python bake_kokoro_weights.py \
  && chown -R nobody:nogroup /app/.cache

ENV HF_HUB_OFFLINE=1

USER nobody
EXPOSE 8080

CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
