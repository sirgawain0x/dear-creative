/**
 * Measures Kokoro cold load → first streamed sentence (WASM) in Chrome.
 * Desktop + mobile viewport with 4× CPU throttle (labeled emulated mobile).
 */
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLE_TEXT =
  "Dear Creative dispatch listen test. Kokoro streams sentence by sentence in your browser.";

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function startNext(port) {
  return spawn("npm", ["run", "start", "--", "-p", String(port)], {
    cwd: REPO_ROOT,
    stdio: "ignore",
    env: { ...process.env, PORT: String(port) },
  });
}

async function waitForHttp(url, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function measureScenario(label, contextOptions, pageSetup) {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  if (pageSetup) {
    await pageSetup(page);
  }

  const result = await page.evaluate(async (text) => {
    const t0 = performance.now();
    const { KokoroTTS, TextSplitterStream } = await import(
      "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm"
    );
    await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: "wasm",
      progress_callback: () => {},
    });
    const modelReadyMs = performance.now() - t0;
    const tts = await KokoroTTS.from_pretrained(
      "onnx-community/Kokoro-82M-v1.0-ONNX",
      {
        dtype: "q8",
        device: "wasm",
      },
    );
    const splitter = new TextSplitterStream();
    const stream = tts.stream(splitter, { voice: "af_heart" });
    const tokens = text.match(/\s*\S+/g) ?? [text];
    for (const token of tokens) splitter.push(token);
    splitter.close();
    let firstAudioMs = null;
    for await (const chunk of stream) {
      firstAudioMs = performance.now() - t0;
      void chunk.audio.audio.length;
      break;
    }
    return { modelReadyMs, firstAudioMs };
  }, SAMPLE_TEXT);

  await browser.close();
  return { label, ...result };
}

async function main() {
  const port = await getFreePort();
  const child = startNext(port);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForHttp(`${baseUrl}/`);
    const desktop = await measureScenario("desktop-chrome", {
      viewport: { width: 1280, height: 800 },
    });
    const mobile = await measureScenario(
      "mobile-emulated-4x-cpu-iphone-390",
      {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      async (page) => {
        const client = await page.context().newCDPSession(page);
        await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      },
    );

    const out = {
      measuredAt: new Date().toISOString(),
      modelId: "onnx-community/Kokoro-82M-v1.0-ONNX",
      dtype: "q8",
      device: "wasm",
      q8OnnxBytes: 92361116,
      desktop,
      mobile,
      disclaimer:
        "Playwright page context via jsDelivr ESM; production uses bundled worker with WebGPU→WASM fallback.",
    };

    const outPath = path.join(REPO_ROOT, "docs/kokoro-browser-benchmark.json");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
  } finally {
    child.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
