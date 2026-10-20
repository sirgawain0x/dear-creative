let oracleEnabledOverride: boolean | undefined;

export function setOracleEnabledForTests(value: boolean | undefined): void {
  oracleEnabledOverride = value;
}

/** When false (default), oracle cron and resolver are no-ops. */
export function isOracleEnabled(): boolean {
  if (oracleEnabledOverride !== undefined) {
    return oracleEnabledOverride;
  }
  return process.env.ORACLE_ENABLED?.trim().toLowerCase() === "true";
}
