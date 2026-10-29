/**
 * App list ported verbatim from sirgawain0x/crtv3
 * `components/navbar/CreativePlatformAppsDrawer.tsx` (URLs, order, descriptions).
 * Current-app badge is app-specific: News on Dear Creative (crtv3 marks TV).
 */
export const CREATIVE_PLATFORM_CURRENT_APP_NAME = "News" as const;

export type CreativePlatformAppName =
  | "News"
  | "Books"
  | "TV"
  | "Pixels"
  | "Finance"
  | "Mixtape"
  | "Beat Me"
  | "Podcast";

export type CreativePlatformAppDefinition = {
  name: CreativePlatformAppName;
  href: string;
  description: string;
};

/** Order and copy match crtv3 `CREATIVE_PLATFORM_APPS` (excluding per-app `isCurrent`). */
export const CREATIVE_PLATFORM_APP_DEFINITIONS: readonly CreativePlatformAppDefinition[] =
  [
    {
      name: "News",
      href: "https://news.creativeplatform.xyz",
      description: "Stories and updates from the platform",
    },
    {
      name: "Books",
      href: "https://books.creativeplatform.xyz",
      description: "Read and publish creative books",
    },
    {
      name: "TV",
      href: "https://tv.creativeplatform.xyz",
      description: "Watch and discover video content",
    },
    {
      name: "Pixels",
      href: "https://create.creativeplatform.xyz",
      description: "Create with AI-powered tools",
    },
    {
      name: "Finance",
      href: "https://finance.creativeplatform.xyz",
      description: "Manage your creative finances",
    },
    {
      name: "Mixtape",
      href: "https://air.creativeplatform.xyz/app",
      description: "Curate and share music mixes",
    },
    {
      name: "Beat Me",
      href: "https://beatme.creativeplatform.xyz",
      description: "Compete in rhythm challenges",
    },
    {
      name: "Podcast",
      href: "https://open.spotify.com/show/4zAsBnJwZKquxvI7oPqRam?si=ZCEjVk6VQ4ClhyCsabtn8A",
      description: "Listen on Spotify",
    },
  ] as const;

export function isCreativePlatformCurrentApp(
  name: CreativePlatformAppName,
): boolean {
  return name === CREATIVE_PLATFORM_CURRENT_APP_NAME;
}
