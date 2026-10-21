/** Mock admin posts for layout / overflow tests (no live API or secrets). */
export function buildAdamPostsFixture(count = 40) {
  return Array.from({ length: count }, (_, i) => ({
    id: `fixture-post-${i}`,
    slug:
      i === 0
        ? `fixture-long-slug-${"x".repeat(72)}`
        : `fixture-post-slug-${i}`,
    title: `Fixture Post ${i}: editorial list card title`,
    status: i % 4 === 0 ? ("draft" as const) : ("published" as const),
    publishedAt:
      i % 4 === 0 ? null : "2024-06-15T14:00:00.000Z",
    teaser: "Fixture teaser for mobile layout checks.",
    emailSubject: `Fixture subject ${i}`,
    markdown: "# Fixture\n\nBody copy for editor overflow checks.",
    html: "<p>Fixture body for editor overflow checks.</p>",
    bannerUrl: null,
    audioUrl: null,
    audioVoice: null,
  }));
}

export const STUDIO_TOKEN_FIXTURE = "fixture-studio-token-layout-test";
