// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Liste des utilisateurs pour l’authentification et le fallback email
export const USERS = [
  {
    id: "1",
    username: "nino.marquet",
    password: "1",
    name: "Nino Marquet",
    email: "nino.marquet@stirweld.com",
  },
  {
    id: "2",
    username: "anthony.trouve",
    password: "2",
    name: "Anthony Trouvé",
    email: "anthony.trouve@stirweld.com",
  },
  {
    id: "3",
    username: "dominique.dubourg",
    password: "3",
    name: "Dominique Dubourg",
    email: "dominique.dubourg@stirweld.com",
  },
  {
    id: "4",
    username: "gabin.dubourg",
    password: "4",
    name: "Gabin Dubourg",
    email: "gabin.dubourg@stirweld.com",
  },
  {
    id: "5",
    username: "gabin.vigor",
    password: "5",
    name: "Gabin Vigor",
    email: "gabin.vigor@stirweld.com",
  },
];

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Utilisateur", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        // Vérifie username + password
        const user = USERS.find(
          (u) =>
            u.username === credentials.username &&
            u.password === credentials.password
        );
        if (user) {
          // Retourne l’objet session avec l’email
          return { id: user.id, name: user.name, email: user.email, image: null };
        }
        return null;
      },
    }),
  ],

  session: {
    strategy: "jwt", // on utilise le JWT pour propager l’email
  },

  callbacks: {
    // Ajoute name et email dans le token JWT
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.image = user.image;
      }
      return token;
    },
    // Rend name et email disponibles dans session.user côté client
    async session({ session, token }) {
      session.user.name = token.name;
      session.user.email = token.email;
      session.user.image = token.image;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});
