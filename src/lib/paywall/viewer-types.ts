export type PostViewer = {
  privyUserId: string;
  linkedWalletAddresses: string[];
  isAdmin: boolean;
  /** Writer row id when linked wallets match a writer payout wallet. */
  writerId: string | null;
};
