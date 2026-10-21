import { describe, expect, it } from "vitest";
import { memberSubToPersonUrn } from "./member-urn";

describe("memberSubToPersonUrn", () => {
  it("maps OIDC sub to person URN", () => {
    expect(memberSubToPersonUrn("782bbtaQ")).toBe("urn:li:person:782bbtaQ");
  });
});
