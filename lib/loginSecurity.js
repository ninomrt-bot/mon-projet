import { randomUUID } from 'crypto';

// In-memory store for login attempts { userId: { count, lockUntil } }
const attempts = new Map();

// Updated password hashes after a reset
const passwordOverrides = new Map();

// Reset tokens { token: { userId, expires } }
const resetTokens = new Map();

export function isLocked(userId) {
  const info = attempts.get(userId);
  if (!info) return { locked: false };
  if (info.lockUntil && info.lockUntil > Date.now()) {
    return { locked: true, remainingMs: info.lockUntil - Date.now() };
  }
  return { locked: false };
}

export function recordFailed(userId) {
  const info = attempts.get(userId) || { count: 0, lockUntil: 0 };
  info.count += 1;
  let delay = 0;
  if (info.count >= 15) delay = 30 * 60 * 1000; // 30 min
  else if (info.count >= 10) delay = 10 * 60 * 1000; // 10 min
  else if (info.count >= 5) delay = 1 * 60 * 1000; // 1 min
  if (delay > 0) info.lockUntil = Date.now() + delay;
  attempts.set(userId, info);
}

export function clearAttempts(userId) {
  attempts.delete(userId);
}

export function getPasswordHash(userId, defaultHash) {
  return passwordOverrides.get(userId) || defaultHash;
}

export function setPasswordHash(userId, hash) {
  passwordOverrides.set(userId, hash);
}

export function createResetToken(userId) {
  const token = randomUUID();
  resetTokens.set(token, { userId, expires: Date.now() + 60 * 60 * 1000 }); // 1h
  return token;
}

export function consumeResetToken(token) {
  const entry = resetTokens.get(token);
  if (!entry) return null;
  resetTokens.delete(token);
  if (entry.expires < Date.now()) return null;
  return entry.userId;
}

export function cleanupTokens() {
  const now = Date.now();
  for (const [t, info] of resetTokens) {
    if (info.expires < now) resetTokens.delete(t);
  }
}
