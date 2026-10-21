export const EARN_VAULT_AAVE_ID = "r6gja8goguw7lktlagdsh0og";
export const EARN_VAULT_MORPHO_ID = "c97jv0ol00uc47lgp1cs7rl5";

export const EARN_VAULT_IDS = [
  EARN_VAULT_AAVE_ID,
  EARN_VAULT_MORPHO_ID,
] as const;

export type EarnVaultId = (typeof EARN_VAULT_IDS)[number];

const EARN_VAULT_ID_SET = new Set<string>(EARN_VAULT_IDS);

export function isKnownEarnVaultId(id: string): id is EarnVaultId {
  return EARN_VAULT_ID_SET.has(id);
}
