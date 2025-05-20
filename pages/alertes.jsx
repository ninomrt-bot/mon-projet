// pages/alertes.jsx
import React, { useState, useEffect } from "react";
import { useSession }        from "next-auth/react";
import { useRouter }         from "next/router";
import useSWR                from "swr";

const fetcher = url => fetch(url).then(r => r.json());

export default function AlertesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: stock, error } = useSWR("/api/stock", fetcher);

  // Redirection si pas connecté
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") return <p>Chargement session…</p>;
  if (status === "unauthenticated") return null;
  if (error) return <p>Erreur de chargement.</p>;
  if (!stock) return <p>Chargement stock…</p>;

  // Ne garder que les lignes où Qte stock ≤ Qte mini
  const alerts = stock.filter(item => {
    const inStock = Number(item["Qte stock"] || 0);
    const mini    = Number(item["Qte mini"]  || 0);
    return inStock <= mini;
  });

  // En-têtes de tableau
  const headers = [
    "Marque",
    "Ref",
    "Désignation",
    "Fournisseurs",   // ← on l’ajoute ici
    "Qte stock",
    "Qte mini"
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        Alertes de stock bas
      </h1>

      {alerts.length === 0 ? (
        <p>Tous les articles sont au-dessus du seuil minimal.</p>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                {headers.map(h => (
                  <th key={h} className="px-2 py-1 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map((row, i) => (
                <tr key={i} className="bg-red-50 hover:bg-red-100">
                  <td className="px-2 py-1">{row.Marque}</td>
                  <td className="px-2 py-1">{row.Ref}</td>
                  <td className="px-2 py-1">{row["Désignation"]}</td>
                  <td className="px-2 py-1">{row.Fournisseurs}</td>
                  <td className="px-2 py-1">{row["Qte stock"]}</td>
                  <td className="px-2 py-1">{row["Qte mini"]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
