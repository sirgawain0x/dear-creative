# Kokoro-82M on CPU for publish-time narration (weights baked at build time).
FROM python:3.11-slim-bookworm AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends espeak-ng ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV HF_HOME=/app/.cache/huggingface \
    KOKORO_DEFAULT_VOICE=af_heart \
    KOKORO_LANG_CODE=a \
    PORT=8080

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake model + voice weights into the image (no Hub fetch on cold start).
RUN python -c "from kokoro import KPipeline; KPipeline(lang_code='a')"

COPY app.py .

USER nobody
EXPOSE 8080

CMD ["sh", "-c", "exec uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
