let xLiveOverride: boolean | undefined;

export function setXLiveEnabledForTests(value: boolean | undefined): void {
  xLiveOverride = value;
}

/** When false (default), posts are logged only — no call to POST /2/tweets. */
export function isXLiveEnabled(): boolean {
  if (xLiveOverride !== undefined) {
    return xLiveOverride;
  }
  return process.env.X_LIVE?.trim().toLowerCase() === "true";
}
