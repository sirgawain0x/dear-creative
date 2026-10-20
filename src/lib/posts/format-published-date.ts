export function formatPublishedDateEt(isoPublishedAt: string): string {
  return new Date(isoPublishedAt).toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: "America/New_York",
  });
}
