import { describe, expect, it } from "vitest";
import {
  LISTEN_SKIP_BACK_ARIA,
  LISTEN_SKIP_FORWARD_ARIA,
  listenSeekTransportAriaOrder,
} from "./dispatch-audio-player-controls";

describe("listenSeekTransportAriaOrder", () => {
  it("orders controls as −10s, play/pause, +10s", () => {
    expect(listenSeekTransportAriaOrder()).toEqual([
      LISTEN_SKIP_BACK_ARIA,
      "play/pause",
      LISTEN_SKIP_FORWARD_ARIA,
    ]);
    expect(LISTEN_SKIP_BACK_ARIA).toBe("Seek back 10 seconds");
    expect(LISTEN_SKIP_FORWARD_ARIA).toBe("Seek forward 10 seconds");
  });
});
