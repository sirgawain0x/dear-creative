/**
 * @vitest-environment jsdom
 */
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureSignupSrc } from "./capture-signup-src";
import { SIGNUP_SRC_COOKIE_NAME } from "@/lib/subscribers/signup-src-cookie";
import { SIGNUP_SRC_SESSION_KEY } from "@/lib/subscribers/signup-src-session";

let mockPathname = "/";
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

function clearStores(): void {
  sessionStorage.clear();
  document.cookie = `${SIGNUP_SRC_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

describe("CaptureSignupSrc", () => {
  afterEach(() => {
    clearStores();
    mockPathname = "/";
    mockSearchParams = new URLSearchParams();
  });

  it("captures src on first client navigation when nothing is stored yet", () => {
    mockSearchParams = new URLSearchParams("src=yt");
    const { rerender } = render(<CaptureSignupSrc />);
    expect(sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY)).toBe("yt");

    mockPathname = "/news";
    mockSearchParams = new URLSearchParams("src=hashnode");
    rerender(<CaptureSignupSrc />);
    expect(sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY)).toBe("yt");
  });

  it("does not recapture when a stored value already exists", () => {
    sessionStorage.setItem(SIGNUP_SRC_SESSION_KEY, "existing");
    mockSearchParams = new URLSearchParams("src=new");
    render(<CaptureSignupSrc />);
    expect(sessionStorage.getItem(SIGNUP_SRC_SESSION_KEY)).toBe("existing");
  });
});
