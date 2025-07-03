// lib/auth-utils.js

// Simule le hash du mot de passe, à adapter selon ta vraie méthode
export function getPasswordHash(userId, passwordHash) {
  // Ici tu peux juste retourner passwordHash si déjà hashé
  return passwordHash;
}

// Gestion du verrouillage (exemple simple)
const lockedUsers = new Map();

export function isLocked(userId) {
  const locked = lockedUsers.get(userId);
  if (locked && locked.expire > Date.now()) {
    return { locked: true, remainingMs: locked.expire - Date.now() };
  }
  return { locked: false, remainingMs: 0 };
}

export function recordFailed(userId) {
  // Enregistre une tentative échouée (exemple basique)
  // Ici tu peux augmenter un compteur, etc.
  lockedUsers.set(userId, { expire: Date.now() + 5 * 60 * 1000 }); // verrouillage 5 minutes
}

export function clearAttempts(userId) {
  // Supprime le verrouillage
  lockedUsers.delete(userId);
}
