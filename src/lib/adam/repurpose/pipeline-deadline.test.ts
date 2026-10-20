import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchWithRepurposePipelineDeadline,
  REPURPOSE_PER_CALL_TIMEOUT_MESSAGE,
  REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE,
  uploadWithRepurposePipelineDeadline,
  wrapFetchForRepurposePipeline,
} from "./pipeline-deadline";

describe("fetchWithRepurposePipelineDeadline errors", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports per-call timeout when wall budget remains", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(0);
    let now = 0;
    const deadlineAtMs = 10_000;
    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const promise = fetchWithRepurposePipelineDeadline(
      fetchFn as typeof fetch,
      "https://example.com",
      { method: "GET" },
      deadlineAtMs,
      50,
      now,
    );
    const rejection = expect(promise).rejects.toThrow(
      REPURPOSE_PER_CALL_TIMEOUT_MESSAGE,
    );
    now = 100;
    await vi.runAllTimersAsync();
    await rejection;
  });

  it("reports wall-clock deadline when the pipeline budget is exhausted", async () => {
    const deadlineAtMs = 100;
    await expect(
      fetchWithRepurposePipelineDeadline(
        fetch as typeof fetch,
        "https://example.com",
        { method: "GET" },
        deadlineAtMs,
        50,
        200,
      ),
    ).rejects.toThrow(REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE);
  });

  it("classifies abort using time at abort, not call start", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(0);
    const deadlineAtMs = 150;
    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const promise = fetchWithRepurposePipelineDeadline(
      fetchFn as typeof fetch,
      "https://example.com",
      { method: "GET" },
      deadlineAtMs,
      500,
      0,
    );
    const rejection = expect(promise).rejects.toThrow(
      REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE,
    );
    vi.setSystemTime(200);
    await vi.runAllTimersAsync();
    await rejection;
  });
});

describe("wrapFetchForRepurposePipeline", () => {
  it("preserves Request method, body, and headers", async () => {
    const fetchFn = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response("ok"));
    const wrapped = wrapFetchForRepurposePipeline(
      fetchFn as typeof fetch,
      10_000,
      5_000,
      () => 0,
    );
    const body = JSON.stringify({ q: 1 });
    const request = new Request("https://example.com/deck", {
      method: "POST",
      headers: { "X-Custom": "keep-me", "Content-Type": "application/json" },
      body,
    });

    await wrapped(request);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [passed] = fetchFn.mock.calls[0] as [RequestInfo | URL];
    expect(passed).toBeInstanceOf(Request);
    const req = passed as Request;
    expect(req.method).toBe("POST");
    expect(req.headers.get("X-Custom")).toBe("keep-me");
    expect(await req.text()).toBe(body);
    expect(req.signal.aborted).toBe(false);
  });
});

describe("uploadWithRepurposePipelineDeadline abort classification", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses wall-clock message when budget is exhausted at abort time", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(0);
    const uploadFn = vi.fn(
      (_file: Blob, _name?: string, signal?: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    const promise = uploadWithRepurposePipelineDeadline(
      uploadFn,
      new Blob(["x"]),
      "f.bin",
      150,
      500,
      0,
    );
    const rejection = expect(promise).rejects.toThrow(
      REPURPOSE_VIDEO_WALL_TIMEOUT_MESSAGE,
    );
    vi.setSystemTime(200);
    await vi.runAllTimersAsync();
    await rejection;
  });
});
