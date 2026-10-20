export function normalizeWalletAddress(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(trimmed)) {
    throw new Error("Invalid wallet address");
  }
  return trimmed;
}

export function normalizeEmail(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.includes("@")) {
    throw new Error("Invalid email address");
  }
  return trimmed;
}

export function formatWalletLabel(wallet: string): string {
  const w = wallet.trim();
  if (w.length <= 12) {
    return w;
  }
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}
