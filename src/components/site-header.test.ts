import { describe, expect, it } from "vitest";
import {
  getSubscribeNavHref,
  getVisibleNavLinks,
  isNavLinkActive,
  SITE_NAV_LINKS,
  SUBSCRIBE_NAV_HREF,
} from "./site-header";

describe("SiteHeader navigation config", () => {
  it("includes links for Home, Posts, Subscribe, Studio, Approvals, and Admin", () => {
    const hrefs = SITE_NAV_LINKS.map((link) => link.href);
    expect(hrefs).toEqual([
      "/",
      "/posts",
      SUBSCRIBE_NAV_HREF,
      "/adam",
      "/approvals",
      "/admin",
    ]);
  });

  it("points Subscribe at the homepage signup anchor from other routes", () => {
    expect(getSubscribeNavHref("/posts")).toBe("/#subscribe");
    expect(getSubscribeNavHref("/")).toBe("#subscribe");
  });

  it("marks /subscribe page active for the Subscribe nav item", () => {
    const subscribeLink = SITE_NAV_LINKS.find((l) => l.homeSubscribeAnchor)!;
    expect(isNavLinkActive("/subscribe", subscribeLink)).toBe(true);
    expect(isNavLinkActive("/", subscribeLink)).toBe(false);
  });

  it("labels the admin link as Sign In", () => {
    const adminLink = SITE_NAV_LINKS.find((l) => l.href === "/admin")!;
    expect(adminLink.label).toBe("Sign In");
  });

  it("labels the adam link as Studio", () => {
    const studioLink = SITE_NAV_LINKS.find((l) => l.href === "/adam")!;
    expect(studioLink.label).toBe("Studio");
  });

  it("filters out Studio and Approvals when not signed in", () => {
    const unauthenticatedLinks = getVisibleNavLinks(false);
    const unauthenticatedHrefs = unauthenticatedLinks.map((l) => l.href);
    expect(unauthenticatedHrefs).toEqual([
      "/",
      "/posts",
      SUBSCRIBE_NAV_HREF,
      "/admin",
    ]);
    expect(unauthenticatedHrefs).not.toContain("/adam");
    expect(unauthenticatedHrefs).not.toContain("/approvals");
  });

  it("shows Studio and Approvals when signed in", () => {
    const authenticatedLinks = getVisibleNavLinks(true);
    const authenticatedHrefs = authenticatedLinks.map((l) => l.href);
    expect(authenticatedHrefs).toEqual([
      "/",
      "/posts",
      SUBSCRIBE_NAV_HREF,
      "/adam",
      "/approvals",
      "/admin",
    ]);
  });

  it("matches exact root path and prefix subpaths accurately", () => {
    const homeLink = SITE_NAV_LINKS.find((l) => l.href === "/")!;
    const postsLink = SITE_NAV_LINKS.find((l) => l.href === "/posts")!;
    const adamLink = SITE_NAV_LINKS.find((l) => l.href === "/adam")!;

    expect(isNavLinkActive("/", homeLink)).toBe(true);
    expect(isNavLinkActive("/posts", homeLink)).toBe(false);

    expect(isNavLinkActive("/posts", postsLink)).toBe(true);
    expect(
      isNavLinkActive("/posts/warner-bought-the-lie-detector", postsLink),
    ).toBe(true);
    expect(isNavLinkActive("/adam", postsLink)).toBe(false);

    expect(isNavLinkActive("/adam", adamLink)).toBe(true);
  });
});
