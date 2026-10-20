# Kokoro TTS on Google Cloud Run

Publish-time narration for Dear Creative uses **Kokoro-82M** (`hexgrad/kokoro` Python package, voice **`af_heart`**, CPU inference) in a **dedicated Cloud Run service**, not in the reader’s browser.

## Why a separate service (not Adam ADK)

| Option | Verdict |
| --- | --- |
| **Route inside `dear-creative-adam` (Node ADK)** | Adam’s container is a lightweight TypeScript ADK agent (~1 GiB, Vertex/Gemini). Adding PyTorch + espeak + ~300 MiB Kokoro weights would bloat cold starts, mix unrelated scaling, and couple editorial agent uptime to CPU-heavy TTS. |
| **Dedicated `dear-creative-kokoro-tts` (this doc)** | **Chosen:** Python matches [hexgrad/kokoro](https://github.com/hexgrad/kokoro) docs (`KPipeline`), CPU TTS scales independently, `min-instances=0`, **app-level Bearer auth** (see below). |

Dear Creative (Vercel) calls the service over HTTPS with `KOKORO_TTS_TOKEN` when `NARRATION_PROVIDER=kokoro`.

## Cloud Run auth model (Vercel-compatible)

Vercel serverless **cannot** present a Google OIDC identity token to satisfy Cloud Run IAM. This design therefore uses:

| Layer | Setting |
| --- | --- |
| **Cloud Run IAM** | `--allow-unauthenticated` so HTTPS reaches the container |
| **Application** | `Authorization: Bearer <KOKORO_TTS_TOKEN>` required on `POST /v1/synthesize`; **`hmac.compare_digest`**; **401** if the header is missing, malformed, or wrong |
| **Public** | `GET /healthz` only (no synthesis without Bearer) |

Do **not** deploy with `--no-allow-unauthenticated` unless every caller (including Vercel) uses Google identity tokens.

## Source layout

- `services/kokoro-tts/` — `app.py`, `Dockerfile`, `test_auth.py`
- `scripts/gcp/kokoro-deploy-cloud-run.sh` — idempotent Cloud Shell deploy (not run in CI)

## GCP target

| Setting | Value |
| --- | --- |
| Project | `creative-ai-491118` |
| Region | `us-east4` |
| Service | `dear-creative-kokoro-tts` |
| CPU / memory | **2 vCPU**, **2 GiB** |
| Scaling | `min-instances=0`, `max-instances=2`, concurrency **1** |
| Timeout | **300s** |

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
| `KOKORO_TTS_TOKEN` | Same shared secret as Cloud Run |
| `KOKORO_TTS_TIMEOUT_MS` | Default **240000** ms |
| `NARRATION_PROVIDER` | `kokoro` (default) or `gemini` |
| `NARRATION_GEMINI_FALLBACK` | `true` to use Gemini TTS if Kokoro fails |

---

## Cloud Shell — start to finish

Run on a machine with **`gcloud auth login`** and project **`creative-ai-491118`**. Agents and CI **do not** run this.

1. **Clone and enter the repo** (or open Cloud Shell from GitHub).

2. **One-shot deploy** (enables APIs, creates Artifact Registry repo `dear-creative` if missing, creates secret if missing, builds, deploys, verifies 401):

```bash
export GCP_PROJECT_ID=creative-ai-491118
export GCP_REGION=us-east4
./scripts/gcp/kokoro-deploy-cloud-run.sh
```

The script:

- Enables **Run**, **Artifact Registry**, **Cloud Build**, **Secret Manager**
- Creates **`dear-creative`** Docker repo in **`us-east4`** if absent
- Creates secret **`dear-creative-kokoro-tts-token`** with `openssl rand -hex 32 | gcloud secrets create … --data-file=-` **only if the secret does not exist** (token never echoed)
- Grants **`roles/secretmanager.secretAccessor`** on that secret to the runtime service account
- **Cloud Build** + deploy with **`--allow-unauthenticated`**, **`min-instances=0`**, **`max-instances=2`**
- Prints the **service URL**
- **`curl`** POST `/v1/synthesize` **without** a token → must return **401**

Re-runs are safe: existing secret/repo/service account are left unchanged.

3. **Copy the token into Vercel** (operator only — never commit or paste into tickets):

On your **own** workstation or Cloud Shell (output stays local):

```bash
gcloud secrets versions access latest \
  --secret=dear-creative-kokoro-tts-token \
  --project=creative-ai-491118
```

- Paste into Vercel → Project → Settings → Environment Variables → **`KOKORO_TTS_TOKEN`**
- Set **`KOKORO_TTS_BASE_URL`** to the URL printed by the deploy script

Optional on Linux with `xclip`: pipe the `gcloud secrets versions access` command to `xclip -selection clipboard` instead of displaying in the terminal.

4. **Redeploy an existing image tag** (skip build):

```bash
./scripts/gcp/kokoro-deploy-cloud-run.sh --skip-build --image us-east4-docker.pkg.dev/creative-ai-491118/dear-creative/kokoro-tts:latest
```

---

## Image size (expected)

After `docker build`, expect roughly **1.4–2.2 GiB** compressed in Artifact Registry (PyTorch CPU + Kokoro/misaki + espeak).

## API

```http
POST /v1/synthesize
Authorization: Bearer <KOKORO_TTS_TOKEN>
Content-Type: application/json
Accept: audio/mpeg

{"text":"Hello dispatch.","voice":"af_heart","format":"mp3"}
```

Response: `audio/mpeg` body. Missing or invalid Bearer → **401 Unauthorized**.

## Tests

```bash
pip install fastapi pytest httpx numpy pydub
cd services/kokoro-tts && pytest test_auth.py -q
```

CI runs the same auth tests (no Kokoro model load).
