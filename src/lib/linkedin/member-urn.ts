export function memberSubToPersonUrn(sub: string): string {
  const trimmed = sub.trim();
  if (!trimmed) {
    throw new Error("linkedin_member_sub_empty");
  }
  return `urn:li:person:${trimmed}`;
}
