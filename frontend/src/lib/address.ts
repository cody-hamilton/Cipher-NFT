import { isAddress } from 'viem';

export function normalizeAddress(input: string): `0x${string}` | null {
  const trimmed = input.trim();
  if (!isAddress(trimmed)) return null;
  return trimmed as `0x${string}`;
}

