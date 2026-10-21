/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  HOME_HERO_SUBSCRIBER_LINE_SAMPLE_COUNT,
  HomeHeroSubscriberLineSample,
} from "./home-hero-subscriber-line-sample";

describe("HomeHeroSubscriberLineSample", () => {
  it("renders the sample subscriber line for harness screenshots", () => {
    const logoSrc = `data:image/png;base64,${readFileSync(
      join(process.cwd(), "public/images/dear-creative-logo.png"),
    ).toString("base64")}`;

    render(
      <HomeHeroSubscriberLineSample
        count={HOME_HERO_SUBSCRIBER_LINE_SAMPLE_COUNT}
        logoSrc={logoSrc}
      />,
    );

    expect(
      screen.getByText(
        `Join ${HOME_HERO_SUBSCRIBER_LINE_SAMPLE_COUNT} creatives reading Dear Creative`,
      ),
    ).toBeInTheDocument();
  });
});
