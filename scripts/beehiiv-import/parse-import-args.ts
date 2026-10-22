export type BeehiivImportCliMode = {
  prod: boolean;
  live: boolean;
  postsPath: string;
  beehiivSubscribersPath: string;
  paragraphSubscribersPath?: string;
  /** Set when --prod --live; exact confirmation phrase from argv or env. */
  prodLiveConfirmation?: string;
};

export function parseImportBeehiivArgs(argv: string[]): BeehiivImportCliMode {
  const prod = argv.includes("--prod");
  const live = argv.includes("--live");
  const confirmIndex = argv.indexOf("--confirm");
  const prodLiveConfirmation =
    confirmIndex >= 0 ? argv[confirmIndex + 1]?.trim() : undefined;

  const paths = argv.filter(
    (arg, index) =>
      !arg.startsWith("-") &&
      !(confirmIndex >= 0 && (index === confirmIndex + 1 || index === confirmIndex)),
  );

  if (paths.length < 2) {
    throw new Error(
      "Usage: npm run import:beehiiv -- [--prod] [--live] [--confirm \"IMPORT TO PROD\"] <posts.csv> <beehiiv-subscribers.csv> [paragraph-subscribers.csv]",
    );
  }

  return {
    prod,
    live,
    postsPath: paths[0]!,
    beehiivSubscribersPath: paths[1]!,
    paragraphSubscribersPath: paths[2],
    prodLiveConfirmation,
  };
}
