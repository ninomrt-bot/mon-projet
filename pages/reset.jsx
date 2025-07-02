import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function ResetPage() {
  const router = useRouter();
  const { token } = router.query;
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: e.target.password.value }),
    });
    if (res.ok) setDone(true);
  };

  if (!token) return null;
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-6 rounded shadow">Mot de passe mis à jour.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex justify-center items-start pt-16 bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-6 rounded shadow-md space-y-6">
        <h1 className="text-xl font-bold text-center">Nouveau mot de passe</h1>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Mot de passe</label>
          <input id="password" name="password" type="password" required className="mt-1 block w-full border px-2 py-1 rounded" />
        </div>
        <button className="w-full bg-blue-600 text-white py-2 rounded">Valider</button>
        <Link href="/login" className="text-blue-600 underline text-sm block text-center">Retour connexion</Link>
      </form>
    </div>
  );
}
