const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = `0x${"0".repeat(40)}`;

export function normalizeWalletAddress(value) {
  const trimmed = String(value ?? "").trim();
  if (!ADDRESS_PATTERN.test(trimmed)) {
    throw new Error("Enter a valid wallet address: 0x followed by 40 hexadecimal characters.");
  }
  const normalized = `0x${trimmed.slice(2).toLowerCase()}`;
  if (normalized === ZERO_ADDRESS) {
    throw new Error("The zero address cannot be authorized.");
  }
  return normalized;
}

export function validateAuthorChange({ value, owner, authors, allowed }) {
  const address = normalizeWalletAddress(value);
  const normalizedOwner = normalizeWalletAddress(owner);
  const normalizedAuthors = authors.map(normalizeWalletAddress);
  if (address === normalizedOwner) {
    throw new Error("The board owner already has author rights.");
  }
  if (allowed && normalizedAuthors.includes(address)) {
    throw new Error("This wallet is already an authorized author.");
  }
  if (allowed && normalizedAuthors.length >= 8) {
    throw new Error("This board already has the maximum of eight authors.");
  }
  if (!allowed && !normalizedAuthors.includes(address)) {
    throw new Error("This wallet is not an authorized author.");
  }
  return address;
}
