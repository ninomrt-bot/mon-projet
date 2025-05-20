// pages/login.jsx
import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Image from "next/image";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [error,   setError]   = useState(null);
  const [showPwd, setShowPwd] = useState(false);

  /* Si déjà connecté, on redirige */
  if (status === "authenticated") {
    router.replace("/");
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const res = await signIn("credentials", {
      redirect: false,
      username: e.target.username.value,
      password: e.target.password.value,
    });

    res.error ? setError("Nom d’utilisateur ou mot de passe invalide")
              : router.replace("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white p-6 rounded shadow-md space-y-4"
      >
        <h1 className="text-xl font-bold text-center">Connexion</h1>
        {error && <div className="text-red-600 text-center">{error}</div>}

        {/* Champ utilisateur */}
        <div>
          <label className="block text-sm font-medium">Utilisateur</label>
          <input
            name="username"
            type="text"
            required
            className="mt-1 block w-full border px-2 py-1 rounded"
          />
        </div>

        {/* Champ mot de passe + bouton oeil */}
        <div className="relative">
          <label className="block text-sm font-medium">Mot de passe</label>

          <input
            name="password"
            type={showPwd ? "text" : "password"}
            required
            className="mt-1 block w-full border px-2 py-1 pr-10 rounded"
          />

          {/* Bouton visible / masquer */}
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute top-10 right-2 -translate-y-1/2 p1"
            aria-label={showPwd ? "Masquer le mot de passe"
                                : "Afficher le mot de passe"}
          >
            <Image
              src={showPwd ? "/masquer.png" : "/visible.png"}
              alt=""
              width={25}
              height={25}
            />
          </button>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}
