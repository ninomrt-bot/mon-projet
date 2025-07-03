// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AsanaProvider from "../../../lib/providers/asana";
import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import {
  isLocked,
  recordFailed,
  clearAttempts,
  getPasswordHash
} from "../../../lib/loginSecurity";


export const authOptions = {
  session: {
    strategy: "jwt"
  },
  providers: [
    // 1) Provider interne (CredentialsProvider)
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Utilisateur", type: "text" },
        password: { label: "Mot de passe", type: "password" }
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


        const pwdHash = getPasswordHash(String(user.id), user.password);

        const lock = isLocked(user.id);
        if (lock.locked) {
          throw new Error(`LOCKED:${Math.ceil(lock.remainingMs / 60000)}`);
        }

        const pwdHash = getPasswordHash(user.id, user.passwordHash);

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
          role: user.role

        };
      }
    }),

    // 2) Provider Asana (OAuth2 via notre fichier lib/providers/asana.js)
    AsanaProvider({
      clientId: process.env.ASANA_CLIENT_ID,
      clientSecret: process.env.ASANA_CLIENT_SECRET
    })
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      // a) Si connexion via CredentialsProvider : NextAuth a déjà ajouté id/name/email/image à token
      if (user && !account) {
        if (user.role) token.role = user.role;
        return token;
      }
      // b) Si connexion via Asana : account.provider === "asana" et account.access_token contient l’accessToken Asana
      if (account?.provider === "asana" && account.access_token) {
        token.asanaAccessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      // 1) Transférer name/email/image (cas CredentialsProvider)
      if (token.name) session.user.name = token.name;
      if (token.email) session.user.email = token.email;
      if (token.image) session.user.image = token.image;
      if (token.role) session.user.role = token.role;
      // 2) Transférer asanaAccessToken (cas AsanaProvider)
      if (token.asanaAccessToken) {
        session.user.asanaAccessToken = token.asanaAccessToken;
      }
      return session;
    }
  },

  pages: {
    signIn: "/login"
  },

  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true
};

export default NextAuth(authOptions);
