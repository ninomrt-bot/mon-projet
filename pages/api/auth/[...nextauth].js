// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AsanaProvider from "../../../lib/providers/asana";
import { USERS } from "../../../data/users.sample";
import bcrypt from "bcryptjs";


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
        const user = USERS.find((u) => u.username === credentials.username);
        if (!user) {
          return null;
        }
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) {
          return null;
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
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

  secret: process.env.NEXTAUTH_SECRET
};

export default NextAuth(authOptions);
