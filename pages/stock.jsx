// pages/stock.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import useSWR from "swr";

const fetcher = (u) => fetch(u).then((r) => r.json());

// ─── Configuration des colonnes ─────────────────────────────────────
const FIELD_PU = "PU HT";
const HEADERS = [
  "Marque",
  "Ref",
  "Désignation",
  "Fournisseurs",
  "PU HT",       // libellé affiché
  "Qte stock",
  "Qte mini",
  "En Commande"
];
// Tous les champs numériques (type=<number> dans le form/modal)
const NUMERIC_FIELDS = ["PU HT", "Qte stock", "Qte mini", "En Commande"];
// ────────────────────────────────────────────────────────────────────

export default function StockPage() {
  // 1 — Auth & données
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: apiStock, error, mutate } = useSWR("/api/stock", fetcher);

  // 2 — Récupérer ref et highlight depuis l’URL
  const { ref: highlightRef, highlight } = router.query;

  // 3 — On reconstruit un tableau propre + on mappe le champ brut PU -> "PU HT"
  const stock = useMemo(() => {
    if (!Array.isArray(apiStock)) return [];
    return apiStock.map((r) => {
      const base = {
        ...r,
        Ref: String(r.Ref ?? "").trim()
      };
      const numeric = {
        "PU HT": Number(r[FIELD_PU] ?? 0),
        "Qte stock": Number(r["Qte stock"] ?? 0),
        "Qte mini": Number(r["Qte mini"] ?? 0),
        "En Commande": Number(r["En Commande"] ?? 0)
      };
      return { ...base, ...numeric };
    });
  }, [apiStock]);

  // 4 — États UI
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [supplier, setSupplier] = useState("");
  const [supSort, setSupSort] = useState(null); // null / "asc" / "desc"

  // modales édition / ajout
  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formVals, setFormVals] = useState({});
  const [errors, setErrors] = useState({});

  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState(
    HEADERS.reduce(
      (o, h) => ({
        ...o,
        [h]: NUMERIC_FIELDS.includes(h) ? 0 : ""
      }),
      {}
    )
  );

  // 5 — Guard : si pas loggué, retour sur /login
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // 6 — Listes de filtres
  const brands = useMemo(
    () =>
      Array.from(
        new Set(stock.map((r) => r.Marque).filter(Boolean))
      ).sort(),
    [stock]
  );

  const suppliers = useMemo(
    () =>
      Array.from(
        new Set(stock.map((r) => r.Fournisseurs).filter(Boolean))
      ).sort(),
    [stock]
  );

  // 7 — Filtrage + tri
  const filtered = useMemo(
    () =>
      stock
        .filter((r) => !brand || r.Marque === brand)
        .filter((r) => !supplier || r.Fournisseurs === supplier)
        .filter((r) => {
          if (!search.trim()) return true;
          const txt = `${r.Marque} ${r.Ref} ${r["Désignation"]} ${r.Fournisseurs}`.toLowerCase();
          return txt.includes(search.toLowerCase().trim());
        }),
    [stock, brand, supplier, search]
  );

  const rows = useMemo(() => {
    if (!supSort) return filtered;
    return [...filtered].sort((a, b) => {
      const A = a.Fournisseurs || "",
        B = b.Fournisseurs || "";
      return supSort === "asc"
        ? A.localeCompare(B)
        : B.localeCompare(A);
    });
  }, [filtered, supSort]);

  // 8 — Scroll & surlignage si “highlight=1” et ref spécifié
  useEffect(() => {
    if (highlight === "1" && highlightRef) {
      // Laisser le temps au tableau de se rendre
      setTimeout(() => {
        const elt = document.getElementById(`item-${highlightRef}`);
        if (elt) {
          elt.scrollIntoView({ behavior: "smooth", block: "center" });
          elt.classList.add("bg-yellow-200", "transition", "duration-500");
          setTimeout(() => {
            elt.classList.remove("bg-yellow-200");
          }, 3000);
        }
      }, 200);
    }
  }, [highlight, highlightRef]);

  // 9 — Handlers édition / ajout
  function openEdit(r) {
    setEditItem(r);
    setFormVals({ ...r });
    setErrors({});
    setShowEdit(true);
  }
  async function onSave() {
    await Promise.all(
      HEADERS.map(async (h) => {
        if (String(editItem[h] ?? "") !== String(formVals[h] ?? "")) {
          await fetch("/api/stock", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              Ref: editItem.Ref,
              field: h,
              value: formVals[h]
            })
          });
        }
      })
    );
    await mutate();
    setShowEdit(false);
  }
  async function onDelete() {
    await fetch(`/api/stock?Ref=${encodeURIComponent(editItem.Ref)}`, {
      method: "DELETE"
    });
    await mutate();
    setShowEdit(false);
  }

  function openAdd() {
    setNewItem(
      HEADERS.reduce(
        (o, h) => ({
          ...o,
          [h]: NUMERIC_FIELDS.includes(h) ? 0 : ""
        }),
        {}
      )
    );
    setShowAdd(true);
  }
  async function onAdd(e) {
    e.preventDefault();
    await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem)
    });

    // Ajout d'un mouvement d'entrée
    await fetch("/api/mouvements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "entree",
        ref: newItem.Ref,
        valeur: Number(newItem["Qte stock"]),
        date: new Date().toISOString(),
        user: session.user.name,
        commentaire: "Ajout manuel stock"
      })
    });

    await mutate();
    setShowAdd(false);
  }

  // 10 — Affichages d’attente / erreur
  if (status === "loading" || !session) return <p>Chargement…</p>;
  if (error) return <p>Erreur de chargement</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Bonjour, {session.user.name}</h1>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="border px-2 py-1 flex-1 min-w-[200px]"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border px-2 py-1"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        >
          <option value="">Toutes marques</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <select
          className="border px-2 py-1"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        >
          <option value="">Tous fournisseurs</option>
          {suppliers.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={openAdd}
          className="bg-green-600 text-white px-4 py-1 rounded"
        >
          + Ajouter
        </button>
      </div>

      {/* Tableau */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              {HEADERS.map((h) => {
                const isSup = h === "Fournisseurs";
                const arrow =
                  isSup && supSort ? (supSort === "asc" ? " ↑" : " ↓") : "";
                return (
                  <th
                    key={h}
                    className="px-2 py-1 text-left select-none"
                    style={isSup ? { cursor: "pointer" } : {}}
                    onClick={
                      isSup
                        ? () =>
                            setSupSort((p) =>
                              p === "asc"
                                ? "desc"
                                : p === "desc"
                                ? null
                                : "asc"
                            )
                        : undefined
                    }
                  >
                    {h}
                    {arrow}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.Ref}|${i}`}
                id={`item-${r.Ref}`}
                onDoubleClick={() => openEdit(r)}
                className={`${
                  i % 2 ? "bg-gray-50" : "bg-white"
                } hover:bg-gray-100 cursor-pointer`}
              >
                {HEADERS.map((h) => (
                  <td key={h} className="border px-2 py-1">
                    {h === "PU HT"
                      ? `${r[h].toFixed(2)} €`
                      : h === "En Commande"
                      ? r[h] > 0 ? (
                          <span className="text-green-600 font-semibold">
                            {r[h]}
                          </span>
                        ) : (
                          <span className="text-gray-500">{r[h]}</span>
                        )
                      : (
                          r[h]
                        )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modale Édition */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Modifier / Supprimer</h2>
            {HEADERS.map((h) => {
              const isNum = NUMERIC_FIELDS.includes(h);
              return (
                <div key={h} className="mb-2">
                  <label className="block mb-1">{h}</label>
                  <input
                    type={isNum ? "number" : "text"}
                    min={isNum ? 0 : undefined}
                    value={formVals[h] ?? (isNum ? 0 : "")}
                    onChange={(e) => {
                      const v = isNum ? Number(e.target.value) : e.target.value;
                      setFormVals((f) => ({ ...f, [h]: v }));
                      if (isNum && v < 0)
                        setErrors((er) => ({ ...er, [h]: true }));
                      else
                        setErrors((er) => {
                          const o = { ...er };
                          delete o[h];
                          return o;
                        });
                    }}
                    className={`border px-2 py-1 w-full ${
                      errors[h] ? "border-red-500" : ""
                    }`}
                  />
                  {errors[h] && (
                    <p className="text-red-600 text-sm">
                      Valeur ≥ 0 requise
                    </p>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowEdit(false)}
                className="px-4 py-1 border rounded"
              >
                Annuler
              </button>
              <button
                onClick={onDelete}
                className="px-4 py-1 bg-red-600 text-white rounded"
              >
                Supprimer
              </button>
              <button
                onClick={onSave}
                disabled={Object.keys(errors).length > 0}
                className={`px-4 py-1 text-white rounded ${
                  Object.keys(errors).length ? "bg-gray-400" : "bg-blue-600"
                }`}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Ajout */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form
            onSubmit={onAdd}
            className="bg-white p-6 rounded shadow-lg w-96"
          >
            <h2 className="text-xl font-bold mb-4">Nouveau composant</h2>
            {HEADERS.map((h) => {
              const isNum = NUMERIC_FIELDS.includes(h);
              if (h === "Fournisseurs") {
                return (
                  <div key={h} className="mb-2">
                    <label className="block mb-1">{h}</label>
                    {newItem.__addFournisseur ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            type="button"
                            onClick={() =>
                              setNewItem((n) => ({
                                ...n,
                                __addFournisseur: false,
                                Fournisseurs: "",
                              }))
                            }
                            className="text-blue-600 underline text-xs"
                          >
                            ← Retour à la liste
                          </button>
                        </div>
                        <input
                          autoFocus
                          type="text"
                          placeholder="Nouveau fournisseur"
                          value={newItem.Fournisseurs}
                          onChange={(e) =>
                            setNewItem((n) => ({
                              ...n,
                              Fournisseurs: e.target.value,
                            }))
                          }
                          className="border px-2 py-1 w-full"
                          required
                        />
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setNewItem((n) => ({
                              ...n,
                              __addFournisseur: true,
                              Fournisseurs: "",
                            }))
                          }
                          className="mb-1 bg-blue-600 text-white text-xs px-2 py-1 rounded"
                        >
                          + Nouveau fournisseur
                        </button>
                        <select
                          value={newItem.Fournisseurs}
                          onChange={(e) =>
                            setNewItem((n) => ({
                              ...n,
                              Fournisseurs: e.target.value,
                            }))
                          }
                          className="border px-2 py-1 w-full"
                          required
                        >
                          <option value="">Choisir…</option>
                          {suppliers.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div key={h} className="mb-2">
                  <label className="block mb-1">{h}</label>
                  <input
                    required
                    type={isNum ? "number" : "text"}
                    min={isNum ? 0 : undefined}
                    value={newItem[h]}
                    onChange={(e) =>
                      setNewItem((n) => ({
                        ...n,
                        [h]: isNum ? Number(e.target.value) : e.target.value,
                      }))
                    }
                    className="border px-2 py-1 w-full"
                  />
                </div>
              );
            })}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-1 border rounded"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-1 bg-green-600 text-white rounded"
              >
                Créer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
