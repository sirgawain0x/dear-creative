# Kokoro TTS on Google Cloud Run

Publish-time narration for Dear Creative uses **Kokoro-82M** (`hexgrad/kokoro` Python package, voice **`af_heart`**, CPU inference) in a **dedicated Cloud Run service**, not in the reader’s browser.

## Why a separate service (not Adam ADK)

| Option | Verdict |
| --- | --- |
| **Route inside `dear-creative-adam` (Node ADK)** | Adam’s container is a lightweight TypeScript ADK agent (~1 GiB, Vertex/Gemini). Adding PyTorch + espeak + ~300 MiB Kokoro weights would bloat cold starts, mix unrelated scaling, and couple editorial agent uptime to CPU-heavy TTS. |
| **Dedicated `dear-creative-kokoro-tts` (this doc)** | **Chosen:** Python matches [hexgrad/kokoro](https://github.com/hexgrad/kokoro) docs (`KPipeline`), CPU TTS scales independently, `min-instances=0` for free-tier idle, Bearer auth without exposing TTS on the public Next.js app. |

Dear Creative (Vercel) calls the service over HTTPS with `KOKORO_TTS_TOKEN` when `NARRATION_PROVIDER=kokoro`.

## Source layout

- `services/kokoro-tts/Dockerfile` — espeak-ng, ffmpeg, baked Hub weights
- `services/kokoro-tts/app.py` — `POST /v1/synthesize` → MP3
- `scripts/gcp/kokoro-deploy-cloud-run.sh` — deploy helper (does not run in CI)

## GCP target

| Setting | Value |
| --- | --- |
| Project | `creative-ai-491118` |
| Region | `us-east4` |
| Service | `dear-creative-kokoro-tts` (override with `KOKORO_CLOUD_RUN_SERVICE`) |
| Auth | `--no-allow-unauthenticated`; callers use `Authorization: Bearer <token>` |
| CPU / memory | **2 vCPU**, **2 GiB** (Kokoro + PyTorch CPU; tune down after profiling) |
| Scaling | `min-instances=0`, `max-instances=2`, concurrency **1** (one synthesis per instance) |
| Timeout | **300s** (matches Next.js `maxDuration` on publish/audio routes) |

## Secrets / env (names only — never commit values)

| Cloud Run env | Set by |
| --- | --- |
| `KOKORO_TTS_TOKEN` | Secret Manager `dear-creative-kokoro-tts-token` |
| `KOKORO_DEFAULT_VOICE` | `af_heart` |
| `KOKORO_LANG_CODE` | `a` (American English) |

On **Dear Creative** (Vercel):

| Env | Purpose |
| --- | --- |
| `KOKORO_TTS_BASE_URL` | Cloud Run service URL (no trailing slash) |
| `KOKORO_TTS_TOKEN` | Same shared secret as the Cloud Run service |
| `KOKORO_TTS_TIMEOUT_MS` | Outbound timeout (default **240000** ms, under route `maxDuration=300`) |
| `NARRATION_PROVIDER` | `kokoro` (default) or `gemini` |
| `NARRATION_GEMINI_FALLBACK` | `true` to use Gemini TTS if Kokoro fails (requires existing Gemini server config) |

## Deploy (operator machine — not run by agents)

```bash
export GCP_PROJECT_ID=creative-ai-491118
export GCP_REGION=us-east4

# Build & push (Artifact Registry repo: dear-creative/kokoro-tts)
gcloud builds submit services/kokoro-tts \
  --tag "${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/dear-creative/kokoro-tts:latest"

# Create secret version (interactive) then:
./scripts/gcp/kokoro-deploy-cloud-run.sh --image "${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/dear-creative/kokoro-tts:latest"
```

Grant **Dear Creative** / CI principals **`roles/run.invoker`** on the service so server-side fetch can obtain identity tokens if you switch from shared Bearer to IAM (current design uses Bearer only).

## Image size (expected)

After `docker build`, expect roughly **1.4–2.2 GiB** compressed in Artifact Registry (PyTorch CPU wheel + Kokoro/misaki weights + espeak). Measure locally:

```bash
docker build -t kokoro-tts:local services/kokoro-tts
docker image inspect kokoro-tts:local --format='{{.Size}}'
```

## API

```http
POST /v1/synthesize
Authorization: Bearer <KOKORO_TTS_TOKEN>
Content-Type: application/json
Accept: audio/mpeg

{"text":"Hello dispatch.","voice":"af_heart","format":"mp3"}
```

Response: `audio/mpeg` body.
