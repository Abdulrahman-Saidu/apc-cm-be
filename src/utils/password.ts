import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// A throwaway hash, made once, used when the account doesn't exist.
let dummyHash: Promise<string> | null = null;

/**
 * Spends the same time as a real password check. Call it when the email
 * isn't found, so response time doesn't reveal which emails have accounts.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash(crypto.randomBytes(16).toString('hex'), ROUNDS);
  await bcrypt.compare(password, await dummyHash);
}
