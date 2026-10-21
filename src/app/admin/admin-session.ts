export type AdminMeSession = {
  userId: string;
  isAdmin: boolean;
  mode: "privy_admin" | "adam_token";
};
