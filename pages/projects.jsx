// pages/projects.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter }  from "next/router";
import useSWR, { useSWRConfig } from "swr";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const fetcher = url => fetch(url).then(r => r.json());

/* utilitaire : récupère une colonne malgré les variantes de libellé */
function pickField(obj, targets) {
  for (const k of targets) if (obj[k]) return obj[k];                   // exact
  const norm = s => s.toLowerCase()
                     .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
                     .replace(/\s+/g,"");
  for (const k of Object.keys(obj)) if (targets.some(t=>norm(t)===norm(k)))
    return obj[k];                                                      // fuzzy
  return "";
}

export default function ProjectsPage() {
  /* 1) session / navigation */
  const { data: session, status } = useSession();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  /* 2) états UI */
  const [selected,    setSelected]   = useState(null);
  const [batchCount,  setBatchCount] = useState(1);
  const [showConfirm, setShowConfirm]= useState(false);
  const [isLoading,   setIsLoading]  = useState(false);   // ← NEW
  const [selectedRows, setSelectedRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState(""); // Ajoute cet état

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  /* 3) données */
  const { data: projects, error: errProj } = useSWR("/api/projects", fetcher);
  const { data: detail } = useSWR(
    () => selected?.slug ? `/api/projects/${encodeURIComponent(selected.slug)}` : null,
    fetcher
  );
  const { data: stock } = useSWR("/api/stock", fetcher);

  /* 4) calculs */
  const existsSet = useMemo(() => new Set(stock?.map(i=>String(i.Ref).trim())||[]), [stock]);

  const rows = useMemo(() => {
    if (!detail || !stock) return [];
    const map = Object.fromEntries(stock.map(i => [String(i.Ref).trim(), Number(i["Qte stock"]||0)]));
    return detail.components.map(c => {
      const ref = String(c.Ref).trim();
      const req = c.qte * batchCount;
      return {
        Ref:         ref,
        Description: pickField(c, ["Description","Désignation"]),
        required:    req,
        inStock:     map[ref] || 0,
        missing:     Math.max(0, req - (map[ref] || 0))
      };
    });
  }, [detail, stock, batchCount]);

  useEffect(() => {
    if (rows.length) setSelectedRows(rows.map(r => r.Ref));
  }, [rows]);

  /* 5) actions */
  async function handleStart() {
    if (selectedRows.length === 0) {
      setErrorMsg("Vous n'avez rien sélectionné !");
      return;
    }
    setErrorMsg(""); // Efface l'erreur si tout va bien
    setIsLoading(true);
    try {
      await Promise.all(
        rows
          .filter(r => selectedRows.includes(r.Ref))
          .map(r =>
            fetch("/api/stock", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                Ref:   r.Ref,
                field: "Qte stock",
                value: Math.max(0, r.inStock - r.required)
              })
            })
          )
      );
      await mutate("/api/stock");
      setShowConfirm(true);
    } finally {
      setIsLoading(false);
    }
  }

  function exportMissingPDF() {
    const doc = new jsPDF();
    doc.text(`Manque pour projet « ${selected.slug} »`, 14, 20);
    autoTable(doc, {
      head: [["Réf","Description","Requis","Stock","Manque"]],          // Groupe retiré
      body: rows.filter(r=>r.missing>0).map(r=>[
        r.Ref, r.Description, r.required, r.inStock, r.missing
      ]),
      startY: 30
    });
    doc.save(`manque_${selected.slug}.pdf`);
  }

  /* 6) chargements */
  if (status==="loading")         return <p>Chargement…</p>;
  if (status==="unauthenticated") return null;
  if (errProj)                    return <p>Erreur chargement projets.</p>;

  /* 7) rendu */
  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Produits</h1>

      {/* liste de projets */}
      {!selected && projects?.map(p => (
        <button key={p.slug} onClick={()=>setSelected(p)}
          className="block w-full text-left px-4 py-2 bg-gray-100 rounded mb-2 hover:bg-gray-200">
          {p.slug}
        </button>
      ))}

      {/* détail d’un projet */}
      {selected && detail && stock && (
        <>
          <button onClick={()=>setSelected(null)}
                  className="text-blue-600 hover:underline mb-4">← Retour</button>

          <h2 className="text-xl font-semibold mb-2">Projet : {selected.slug}</h2>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label>Quantité :</label>
            <input type="number" min={1} value={batchCount}
                   onChange={e=>setBatchCount(Number(e.target.value))}
                   className="border px-2 py-1 w-24" />
            <button onClick={handleStart}
                    className="bg-green-600 text-white px-4 py-1 rounded">
              Démarrer
            </button>
            <button onClick={exportMissingPDF}
                    className="bg-red-600 text-white px-4 py-1 rounded ml-auto">
              Export PDF manque
            </button>
          </div>

          {/* ─── LÉGENDE COULEURS ───────────────────────────────────────────── */}
            <div className="mt-2 text-sm space-x-6">
              <span className="inline-flex items-center">
                <span className="w-4 h-4 mr-1 rounded bg-red-100 border border-red-300"></span>
                <span>Manque (référence connue)</span>
              </span>

              <span className="inline-flex items-center">
                <span className="w-4 h-4 mr-1 rounded bg-orange-100 border border-orange-300"></span>
                <span>Non référencée</span>
              </span>
            </div>

          {/* Affiche le message d'erreur si besoin */}
          {errorMsg && (
            <div className="mb-2 text-red-600 font-semibold">{errorMsg}</div>
          )}

          <div className="overflow-auto border rounded">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedRows.length === rows.length}
                      onChange={e =>
                        setSelectedRows(e.target.checked ? rows.map(r => r.Ref) : [])
                      }
                    />
                  </th>
                  {["Réf","Description","Requis","Stock","Manque"].map(h=>(
                    <th key={h} className="px-2 py-1 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i)=>{
                  const checked = selectedRows.includes(r.Ref);
                  const cls = r.missing>0
                    ? (existsSet.has(r.Ref) ? "bg-red-100" : "bg-orange-100")
                    : "";
                  return (
                    <tr key={i} className={cls}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            setSelectedRows(sel =>
                              e.target.checked
                                ? [...sel, r.Ref]
                                : sel.filter(ref => ref !== r.Ref)
                            );
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">{r.Ref}</td>
                      <td className="px-2 py-1">{r.Description}</td>
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


      {/* pop-up confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg space-y-4">
            <p>Le projet « {selected.slug} » a bien démarré ({batchCount}×).</p>
            <button onClick={()=>setShowConfirm(false)}
                    className="bg-blue-600 text-white px-4 py-1 rounded">OK</button>
          </div>
        </div>
      )}

      {/* overlay chargement */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="flex flex-col items-center">
            {/* simple spinner SVG Tailwind-like */}
            <svg className="animate-spin h-10 w-10 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <p className="text-white mt-2">Traitement…</p>
          </div>
        </div>
      )}
    </div>
  );
}
