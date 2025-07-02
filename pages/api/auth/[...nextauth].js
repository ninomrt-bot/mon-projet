// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AsanaProvider from "../../../lib/providers/asana"; 

// Liste des utilisateurs internes (CredentialsProvider) avec leur image
const USERS = [
  {
    id: "1",
    username: "nino.marquet",
    password: "1",
    name: "Nino Marquet",
    email: "nino.marquet@stirweld.com",
    image: "/photo_user/Ninomarquet.jpg"
  },
  {
    id: "2",
    username: "anthony.trouve",
    password: "2",
    name: "Anthony Trouvé",
    email: "anthony.trouve@stirweld.com",
    image: "/photo_user/Anthonytrouvé.jpg"
  },
  {
    id: "3",
    username: "dominique.dubourg",
    password: "3",
    name: "Dominique Dubourg",
    email: "dominique.dubourg@stirweld.com",
    image: "/photo_user/Dominiquedubourg.jpg"
  },
  {
    id: "4",
    username: "gabin.dubourg",
    password: "4",
    name: "Gabin Dubourg",
    email: "gabin.dubourg@stirweld.com",
    image: "/photo_user/Gabindubourg.jpg"
  },
  {
    id: "5",
    username: "gabin.vigor",
    password: "leplusbeau",
    name: "Gabin Vigor",
    email: "gabin.vigor@stirweld.com",
    image: "/photo_user/Gabinvigor.jpg"
  },
  {
    id: "5",
    username: "admin",
    password: "12345",
    name: "admin",
    email: "admin",
    image: "/photo_user/Ninomarquet.JPG"
  }
];

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
        const user = USERS.find(
          (u) =>
            u.username === credentials.username &&
            u.password === credentials.password
        );
        if (!user) {
          return null;
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image
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
