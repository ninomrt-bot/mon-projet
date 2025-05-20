// pages/projects.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useSession }        from "next-auth/react";
import { useRouter }         from "next/router";
import useSWR, { useSWRConfig } from "swr";
import { jsPDF }   from "jspdf";
import autoTable  from "jspdf-autotable";

const fetcher = url => fetch(url).then(r => r.json());

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  // confirm-popup visibility
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const { data: projects, error: errProj } = useSWR("/api/projects", fetcher);
  const [selected,   setSelected]   = useState(null);
  const [batchCount, setBatchCount] = useState(1);

  const { data: detail } = useSWR(
    () => selected?.slug
      ? `/api/projects/${encodeURIComponent(selected.slug)}`
      : null,
    fetcher
  );
  const { data: stock } = useSWR("/api/stock", fetcher);

  // set of all existing Refs in stock
  const existsSet = useMemo(() => {
    if (!stock) return new Set();
    return new Set(stock.map(i => String(i.Ref).trim()));
  }, [stock]);

  // compute required / inStock / missing per line
  const missing = useMemo(() => {
    if (!detail || !stock) return [];
    const stockMap = Object.fromEntries(
      stock.map(i => [String(i.Ref).trim(), Number(i["Qte stock"] || 0)])
    );
    return detail.components.map(c => {
      const key = String(c.Ref).trim();
      const requiredTotal = c.qte * batchCount;
      const inStock = stockMap[key] || 0;
      const miss = Math.max(0, requiredTotal - inStock);
      return { Ref: key, required: requiredTotal, inStock, missing: miss };
    });
  }, [detail, stock, batchCount]);

  // debit stock & show confirmation
  async function handleStart() {
    await Promise.all(
      missing.map(async row => {
        const newQty = Math.max(0, row.inStock - row.required);
        await fetch("/api/stock", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            Ref:   row.Ref,
            field: "Qte stock",
            value: newQty
          })
        });
      })
    );
    mutate("/api/stock");
    setShowConfirm(true);
  }

  // export missing → PDF
  function exportMissingPDF() {
    const doc = new jsPDF();
    doc.text(`Manque pour projet « ${selected.slug} »`, 14, 20);
  
    const head = [["Réf","Requis","Stock","Manque"]];
    const body = missing
      .filter(r => r.missing > 0)
      .map(r => [r.Ref, r.required, r.inStock, r.missing]);
  
    // call plugin directly
    autoTable(doc, { head, body, startY: 30 });
    doc.save(`manque_${selected.slug}.pdf`);
  }
  

  if (status === "loading")         return <p>Chargement…</p>;
  if (status === "unauthenticated") return null;
  if (errProj)                      return <p>Erreur chargement projets.</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Projets</h1>

      {!selected && projects?.map(p => (
        <button
          key={p.slug}
          onClick={() => setSelected(p)}
          className="block w-full text-left px-4 py-2 bg-gray-100 rounded mb-2 hover:bg-gray-200"
        >
          {p.slug}
        </button>
      ))}

      {selected && detail && stock && (
        <>
          <button
            onClick={() => setSelected(null)}
            className="text-blue-600 hover:underline mb-4"
          >
            ← Retour
          </button>

          <h2 className="text-xl font-semibold mb-2">
            Projet : {selected.slug}
          </h2>

          <div className="mb-4 flex items-center space-x-2">
            <label>Quantité :</label>
            <input
              type="number" min={1} value={batchCount}
              onChange={e => setBatchCount(Number(e.target.value))}
              className="border px-2 py-1 w-20"
            />
            <button
              onClick={handleStart}
              className="bg-green-600 text-white px-4 py-1 rounded"
            >
              Démarrer
            </button>
            <button
              onClick={exportMissingPDF}
              className="bg-red-600 text-white px-4 py-1 rounded ml-auto"
            >
              Exporter le manque (PDF)
            </button>
          </div>

          <div className="overflow-auto border rounded">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-100">
                <tr>
                  {["Réf","Requis","Stock","Manque"].map(h => (
                    <th key={h} className="px-2 py-1 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {missing.map((r,i) => {
                  let rowClass = "";
                  if (r.missing > 0) {
                    rowClass = existsSet.has(r.Ref)
                      ? "bg-red-100"    // exists but not enough → red
                      : "bg-orange-100"; // doesn’t exist at all → orange
                  }
                  return (
                    <tr key={i} className={rowClass}>
                      <td className="px-2 py-1">{r.Ref}</td>
                      <td className="px-2 py-1">{r.required}</td>
                      <td className="px-2 py-1">{r.inStock}</td>
                      <td className="px-2 py-1">{r.missing}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* confirmation pop-up */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg space-y-4">
            <p>
              Le projet « {selected.slug} » a bien démarré ({batchCount}×).
            </p>
            <button
              onClick={() => setShowConfirm(false)}
              className="mt-2 bg-blue-600 text-white px-4 py-1 rounded"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
