import { afterEach, describe, expect, it, vi } from "vitest";
import { generateRepurposeStructuredJson } from "./gemini-json";

describe("generateRepurposeStructuredJson mind_map", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses responseJsonSchema in generationConfig for mind_map", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      title: "Map",
                      root: { label: "Root", children: [] },
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await generateRepurposeStructuredJson({
      outputType: "mind_map",
      source: { title: "T", plainText: "Body" },
      fetchFn,
    });

    const body = JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body)) as {
      generationConfig?: { responseJsonSchema?: unknown; responseSchema?: unknown };
    };
    expect(body.generationConfig?.responseJsonSchema).toBeDefined();
    expect(body.generationConfig?.responseSchema).toBeUndefined();
  });
});
