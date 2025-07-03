import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AsanaProvider from "../../../lib/providers/asana"; // adapte le chemin si besoin
import bcrypt from "bcrypt";
import prisma from "../../../lib/prisma"; // adapte le chemin si besoin
import { getPasswordHash, isLocked, recordFailed, clearAttempts } from "../../../lib/auth-utils"; // adapte selon ton projet

export const authOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Utilisateur", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.username },
        });
        if (!user) return null;

        const lock = isLocked(user.id);
        if (lock.locked) {
          throw new Error(`LOCKED:${Math.ceil(lock.remainingMs / 60000)}`);
        }

        // On récupère le hash correct
        const pwdHash = getPasswordHash(user.id, user.passwordHash);

        // Compare le mot de passe envoyé avec le hash stocké
        const ok = await bcrypt.compare(credentials.password, pwdHash);
        if (!ok) {
          recordFailed(user.id);
          return null;
        }

        clearAttempts(user.id);

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
        };
      },
    }),
    AsanaProvider({
      clientId: process.env.ASANA_CLIENT_ID,
      clientSecret: process.env.ASANA_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Connexion via CredentialsProvider
      if (user && !account) {
        if (user.role) token.role = user.role;
        return token;
      }
      // Connexion via Asana
      if (account?.provider === "asana" && account.access_token) {
        token.asanaAccessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.role) session.user.role = token.role;
      if (token?.asanaAccessToken) session.asanaAccessToken = token.asanaAccessToken;
      return session;
    },
  },
  pages: {
    error: "/auth/error", // Page custom error si besoin
  },
};

export default NextAuth(authOptions);
