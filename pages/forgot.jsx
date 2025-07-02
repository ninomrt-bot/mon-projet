import { useState } from "react";
import Link from "next/link";

export default function ForgotPage() {
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e.target.email.value }),
    });
    if (res.ok) setSent(true);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-6 rounded shadow">Un lien de réinitialisation vous a été envoyé.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex justify-center items-start pt-16 bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-6 rounded shadow-md space-y-6">
        <h1 className="text-xl font-bold text-center">Mot de passe oublié</h1>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required className="mt-1 block w-full border px-2 py-1 rounded" />
        </div>
        <button className="w-full bg-blue-600 text-white py-2 rounded">Envoyer le lien</button>
        <Link href="/login" className="text-blue-600 underline text-sm block text-center">Retour connexion</Link>
      </form>
    </div>
  );
}
