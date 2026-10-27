import { EditorPreviewLinksPanel } from "@/components/admin/EditorPreviewLinksPanel";

const mockLinks = [
  {
    id: "link-1",
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: "did:privy:writer",
  },
];

/** Static share-preview panel for screenshot harnesses (no network). */
export function PreviewLinksShareDialogFixture() {
  return (
    <div className="mx-auto max-w-lg bg-white p-6 dark:bg-zinc-950">
      <EditorPreviewLinksPanel
        postId="fixture-post"
        enabled
        authFetch={async (url, init) => {
          if (init?.method === "POST") {
            return Response.json({
              link: {
                previewUrl:
                  "https://dear.example.test/preview/mock-token-base64url",
              },
            });
          }
          if (url.endsWith("/preview-links")) {
            return Response.json({ links: mockLinks });
          }
          return Response.json({ ok: true });
        }}
      />
    </div>
  );
}
