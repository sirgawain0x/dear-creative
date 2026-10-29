import { describe, expect, it } from "vitest";
import {
  CREATIVE_PLATFORM_APP_DEFINITIONS,
  CREATIVE_PLATFORM_CURRENT_APP_NAME,
  isCreativePlatformCurrentApp,
} from "./apps";

describe("Creative Platform apps (crtv3 parity)", () => {
  it("lists apps in the required order", () => {
    expect(CREATIVE_PLATFORM_APP_DEFINITIONS.map((app) => app.name)).toEqual([
      "News",
      "Books",
      "TV",
      "Pixels",
      "Finance",
      "Mixtape",
      "Beat Me",
      "Podcast",
    ]);
  });

  it("marks News as the current app for Dear Creative", () => {
    expect(CREATIVE_PLATFORM_CURRENT_APP_NAME).toBe("News");
    expect(isCreativePlatformCurrentApp("News")).toBe(true);
    expect(isCreativePlatformCurrentApp("TV")).toBe(false);
  });

  it("uses crtv3 URLs and descriptions verbatim", () => {
    const news = CREATIVE_PLATFORM_APP_DEFINITIONS[0];
    expect(news.href).toBe("https://news.creativeplatform.xyz");
    expect(news.description).toBe("Stories and updates from the platform");

    const podcast = CREATIVE_PLATFORM_APP_DEFINITIONS.at(-1)!;
    expect(podcast.href).toBe(
      "https://open.spotify.com/show/4zAsBnJwZKquxvI7oPqRam?si=ZCEjVk6VQ4ClhyCsabtn8A",
    );
    expect(podcast.description).toBe("Listen on Spotify");
  });
});
