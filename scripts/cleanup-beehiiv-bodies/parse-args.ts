export type CleanupCliMode = {
  prod: boolean;
  live: boolean;
  postsCsvPath?: string;
  prodLiveConfirmation?: string;
};

export function parseCleanupArgs(argv: string[]): CleanupCliMode {
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

  return {
    prod,
    live,
    postsCsvPath: paths[0],
    prodLiveConfirmation,
  };
}
