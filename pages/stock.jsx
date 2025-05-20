// pages/stock.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter }  from "next/router";
import useSWR         from "swr";
import Pagination     from "@mui/material/Pagination";

const fetcher   = (url) => fetch(url).then(r => r.json());
const HEADERS   = ["Marque","Ref","Désignation","Fournisseurs","Qte stock","Qte mini"];
const PAGE_SIZE = 10;

export default function StockPage() {
  // ─── 1) Hooks en tout début ─────────────────────────────────────────
  const { data: session, status }      = useSession();
  const router                         = useRouter();
  const { data: stock, error, mutate } = useSWR("/api/stock", fetcher);

  const [search,   setSearch]   = useState("");
  const [brand,    setBrand]    = useState("");
  const [page,     setPage]     = useState(1);

  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formVals, setFormVals] = useState({});

  const [showAdd,  setShowAdd]  = useState(false);
  const [newItem,  setNewItem]  = useState(
    HEADERS.reduce((o,h)=>(o[h]="",o),{})
  );

  // ─── 2) Hooks dérivés (toujours dans le même ordre) ──────────────────
  const brands = useMemo(() => {
    if (!stock) return [];
    return Array.from(new Set(stock.map(r => r.Marque).filter(Boolean))).sort();
  }, [stock]);

  const filtered = useMemo(() => {
    if (!stock) return [];
    return stock
      .filter(r => !brand || r.Marque === brand)
      .filter(r =>
        !search ||
        (`${r.Marque} ${r.Ref} ${r["Désignation"]} ${r.Fournisseurs}`)
          .toLowerCase()
          .includes(search.toLowerCase().trim())
      );
  }, [stock, brand, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData   = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages || 1);
  }, [page, totalPages]);

  // ─── 3) Redirection en useEffect ───────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // ─── 4) Handlers édition/ajout ─────────────────────────────────────
  function openEdit(row) {
    setEditItem(row);
    setFormVals({ ...row });
    setShowEdit(true);
  }
  async function onSave() {
    await Promise.all(HEADERS.map(field => {
      const oldV = String(editItem[field]  ?? "");
      const newV = String(formVals[field] ?? "");
      if (oldV !== newV) {
        return fetch("/api/stock", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Ref: editItem.Ref, field, value: newV })
        });
      }
      return Promise.resolve();
    }));
    await mutate();
    setShowEdit(false);
  }
  async function onDelete() {
    await fetch(`/api/stock?Ref=${encodeURIComponent(editItem.Ref)}`, { method: "DELETE" });
    await mutate();
    setShowEdit(false);
  }
  function openAdd() {
    setNewItem(HEADERS.reduce((o,h)=>(o[h]="",o),{}));
    setShowAdd(true);
  }
  async function onAdd(e) {
    e.preventDefault();
    await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem)
    });
    await mutate();
    setShowAdd(false);
  }

  // ─── 5) Render conditionnel ─────────────────────────────────────────
  if (status === "loading") return <div>Chargement…</div>;
  if (status === "unauthenticated") return null;
  if (error) return <div>Erreur de chargement</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Bonjour, {session.user.name}</h1>

      {/* Recherche / Filtre / Ajout */}
      <div className="flex gap-2 mb-4">
        <input
          className="border px-2 py-1 flex-1"
          placeholder="Rechercher…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="border px-2 py-1"
          value={brand}
          onChange={e => { setBrand(e.target.value); setPage(1); }}
        >
          <option value="">Toutes marques</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <button
          onClick={openAdd}
          className="bg-green-600 text-white px-4 py-1 rounded"
        >+ Ajouter</button>
      </div>

      {/* Tableau zébré */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              {HEADERS.map(h => (
                <th key={h} className="px-2 py-1 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row,i) => (
              <tr
                key={row.Ref + i}
                onDoubleClick={() => openEdit(row)}
                className={`${i%2===0?"bg-white":"bg-gray-50"} hover:bg-gray-100 cursor-pointer`}
              >
                {HEADERS.map(h => (
                  <td key={h} className="border px-2 py-1">{row[h]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination MUI */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_,p) => setPage(p)}
            siblingCount={1}
            boundaryCount={1}
            color="primary"
          />
        </div>
      )}

      {/* Modal Édition */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Modifier / Supprimer</h2>
            {HEADERS.map(h=>(
              <div key={h} className="mb-2">
                <label className="block mb-1">{h}</label>
                <input
                  className="border px-2 py-1 w-full"
                  value={formVals[h]||""}
                  onChange={e=>setFormVals(v=>({...v,[h]:e.target.value}))}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={()=>setShowEdit(false)} className="px-4 py-1 border rounded">Annuler</button>
              <button onClick={onDelete} className="px-4 py-1 bg-red-600 text-white rounded">Supprimer</button>
              <button onClick={onSave}   className="px-4 py-1 bg-blue-600 text-white rounded">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajout */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <form onSubmit={onAdd} className="bg-white p-6 rounded shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Nouveau composant</h2>
            {HEADERS.map(h=>(
              <div key={h} className="mb-2">
                <label className="block mb-1">{h}</label>
                <input
                  required
                  className="border px-2 py-1 w-full"
                  value={newItem[h]}
                  onChange={e=>setNewItem(n=>({...n,[h]:e.target.value}))}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={()=>setShowAdd(false)} className="px-4 py-1 border rounded">Annuler</button>
              <button type="submit" className="px-4 py-1 bg-green-600 text-white rounded">Créer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
