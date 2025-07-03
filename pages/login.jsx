// pages/login.jsx
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [error, setError] = useState(null);
  const [showPwd, setShowPwd] = useState(false);

  // Si déjà connecté, redirection vers la page d'accueil
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const res = await signIn("credentials", {
      redirect: false,
      username: e.target.email.value,
      password: e.target.password.value,
    });

    if (res.error) {
      if (res.error.startsWith("LOCKED:")) {
        const min = res.error.split(":" )[1];
        setError(`Trop de tentatives. Réessayez dans ${min} minute(s).`);
      } else {
        setError("Nom d’utilisateur ou mot de passe invalide");
      }
    } else {
      router.replace("/");
    }
  };

  // Si on est en train de rediriger, on n'affiche rien
  if (status === "loading" || status === "authenticated") {
    return null;
  }

  return (
    <div className="min-h-screen flex justify-center items-start pt-16 bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white p-6 rounded shadow-md space-y-6"
      >
        <h1 className="text-xl font-bold text-center">Connexion</h1>
        {error && <div className="text-red-600 text-center">{error}</div>}

        {/* Champ email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 block w-full border px-2 py-1 rounded focus:outline-none focus:ring focus:border-blue-300"
          />
        </div>

        {/* Champ mot de passe + bouton œil */}
        <div className="relative">
          <label htmlFor="password" className="block text-sm font-medium">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type={showPwd ? "text" : "password"}
            required
            className="mt-1 block w-full border px-2 py-1 pr-10 rounded focus:outline-none focus:ring focus:border-blue-300"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute top-10 right-2 transform -translate-y-1/2 p-1"
            aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            <Image
              src={showPwd ? "/masquer.png" : "/visible.png"}
              alt={showPwd ? "Masquer" : "Afficher"}
              width={24}
              height={24}
            />
          </button>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          Se connecter
        </button>
        <Link href="/forgot" className="text-blue-600 underline text-sm text-center block">
          Mot de passe oublié ?
        </Link>

        {/* On retire le bouton Asana et le séparateur */}
        {/* 
        <div className="flex items-center justify-center">
          <span className="text-gray-400">ou</span>
        </div>
        <button
          type="button"
          onClick={() => signIn("asana", { callbackUrl: "/projects-asana" })}
          className="w-full border border-gray-300 flex items-center justify-center py-2 rounded hover:bg-gray-100 transition"
        >
          <Image
            src="/asana-logo.png"
            alt="Asana"
            width={20}
            height={20}
            className="mr-2"
          />
          <span className="text-gray-700">Se connecter avec Asana</span>
        </button>
        */}
      </form>
    </div>
  );
}
