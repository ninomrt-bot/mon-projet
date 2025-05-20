// pages/index.js
import { getServerSession } from "next-auth/next";
import { authOptions }      from "./api/auth/[...nextauth]";

export async function getServerSideProps(context) {
  const session = await getServerSession(
    context.req,
    context.res,
    authOptions
  );

  // Si l’utilisateur n’est pas connecté → /login
  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  // Sinon → /stock
  return {
    redirect: {
      destination: "/stock",
      permanent: false,
    },
  };
}

// Composant vide : la page ne s’affiche jamais, on redirige avant
export default function Home() {
  return null;
}
