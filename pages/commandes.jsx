// ...imports existants...
import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import useSWR, { mutate as globalMutate } from "swr";
import { PaperClipIcon, TrashIcon } from "@heroicons/react/24/solid";

const fetcher = (url) => fetch(url).then((r) => r.json());
const STATUTS = ["en cours", "partielle", "terminée"];
const COL_CLASS = {
  "en cours": "bg-yellow-100",
  partielle: "bg-orange-100",
  terminée: "bg-green-100",
};

export default function CommandesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: cmds, error, mutate } = useSWR(
    status === "authenticated" ? "/api/commandes" : null,
    fetcher
  );

  const [file, setFile] = useState(null);
  const [sel, setSel] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [dragId, setDragId] = useState("");
  const [csvPreview, setCsvPreview] = useState("");
  const [showReception, setShowReception] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const kanban = useMemo(() => {
    const cols = STATUTS.reduce((o, s) => ({ ...o, [s]: [] }), {});
    (cmds || []).forEach((c) => {
      const st = STATUTS.includes(c.statut) ? c.statut : "en cours";
      cols[st].push(c);
    });
    return cols;
  }, [cmds]);

  async function uploadPdf(e) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    await fetch("/api/commandes", { method: "POST", body: fd });
    setFile(null);
    mutate();
  }

  async function move(id, toStat) {
    await fetch("/api/commandes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, statut: toStat }),
    });
    mutate();
    if (toStat === "terminée") globalMutate("/api/stock");
    if (sel?.id === id) setSel((prev) => ({ ...prev, statut: toStat }));
  }

  async function send() {
    if (!sel || !newMsg.trim()) return;
    await fetch("/api/commandes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: sel.id,
        newMessage: {
          from: session.user.name,
          text: newMsg.trim(),
          at: new Date().toISOString(),
        },
      }),
    });
    setNewMsg("");
    const updated = await fetcher("/api/commandes");
    mutate(updated, false);
    setSel(updated.find((c) => c.id === sel.id));
  }

  async function del(id) {
    if (!confirm("Supprimer cette commande ?")) return;
    await fetch(`/api/commandes?id=${id}`, { method: "DELETE" });
    mutate();
    if (sel?.id === id) setSel(null);
  }

  useEffect(() => {
    if (!sel) {
      setCsvPreview("");
      return;
    }
    const lower = sel.filename?.toLowerCase() || "";
    if (lower.endsWith(".csv") && sel.url) {
      fetch(sel.url)
        .then((resp) => resp.text())
        .then((txt) => setCsvPreview(txt))
        .catch(() => setCsvPreview("Impossible de charger l’aperçu CSV."));
    } else {
      setCsvPreview("");
    }
  }, [sel]);

  // --- Réception partielle ---
  function parseCsvLines(csv) {
    if (!csv) return [];
    const [header, ...lines] = csv.trim().split("\n");
    const headers = header.split(";");
    return lines
      .filter((l) => l.trim())
      .map((l) => {
        const cells = l.split(";");
        const obj = {};
        headers.forEach((h, i) => (obj[h.trim()] = cells[i]?.trim() || ""));
        // Normalisation des champs pour l'affichage
        obj.Ref = obj.Ref || obj["Réf"] || obj["ref"] || obj["REF"] || ""; // adapte selon ton CSV
        obj.Designation = obj["Désignation"] || obj["Designation"] || "";
        obj.qty =
          Number(obj["Qté"]) ||
          Number(obj["Qte"]) ||
          Number(obj["Quantité"]) ||
          Number(obj["Qte commandée"]) ||
          Number(obj["En Commande"]) ||
          0;
        return obj;
      });
  }

  async function handleReceptionPartielle(lignesRecues) {
    // Appel API pour mettre à jour la commande et le stock
    await fetch("/api/commandes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: sel.id,
        reception: lignesRecues, // [{Ref, qty}]
      }),
    });
    mutate();
    globalMutate("/api/stock");
    setShowReception(false);
    setSel(null);
  }

  if (status === "loading") return <p>Connexion…</p>;
  if (error) return <p className="text-red-600">Erreur de chargement</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Commandes fournisseurs</h1>

      {/* Upload PDF */}
      <form onSubmit={uploadPdf} className="flex items-center gap-2">
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files[0] || null)}
          className="border p-1"
        />
        <button
          type="submit"
          disabled={!file}
          className="bg-blue-600 text-white rounded px-4 py-1 disabled:opacity-50"
        >
          Ajouter PDF
        </button>
      </form>

      {/* Kanban */}
      <div className="flex gap-4">
        {STATUTS.map((st) => (
          <div
            key={st}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) move(dragId, st);
              setDragId("");
            }}
            className={`flex-1 p-3 rounded space-y-2 ${COL_CLASS[st]}`}
          >
            <h2 className="font-semibold mb-2 capitalize">{st}</h2>
            {kanban[st].map((c) => (
              <div
                key={c.id}
                draggable
                onDragStart={() => setDragId(c.id)}
                onClick={() => {
                  setSel(c);
                  setNewMsg("");
                }}
                className="bg-white rounded shadow p-3 space-y-1 cursor-move relative"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    del(c.id);
                  }}
                  className="absolute top-1 right-1 text-red-500"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
                <div className="flex justify-between text-sm">
                  <span>{c.filename || c.id}</span>
                  {c.url && <PaperClipIcon className="h-4 w-4 text-gray-500" />}
                </div>
                <div className="text-xs text-gray-500">
                  Créé par {c.creator}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Détail + aperçu (PDF ou CSV) */}
      {sel && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSel(null)}
        >
          <div
            className="bg-white max-w-xl w-full rounded-lg overflow-auto shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-4 py-2 border-b">
              <h2 className="font-semibold">{sel.filename || sel.id}</h2>
              <button onClick={() => setSel(null)}>✕</button>
            </div>

            <div className="p-4 space-y-4">
              <p>
                <strong>Statut :</strong> {sel.statut}
              </p>
              <p>
                <strong>Fournisseur :</strong> {sel.fournisseur || "N/A"}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Créé par :</strong> {sel.creator} —{" "}
                {new Date(sel.createdAt).toLocaleString("fr-FR")}
              </p>

              {/* Aperçu PDF */}
              {sel.url?.toLowerCase().endsWith(".pdf") && (
                <div className="h-72 border">
                  <object
                    data={sel.url}
                    type="application/pdf"
                    width="100%"
                    height="100%"
                  >
                    PDF non supporté.
                    <a
                      href={sel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Télécharger le PDF
                    </a>
                  </object>
                </div>
              )}

              {/* Aperçu CSV */}
              {sel.url?.toLowerCase().endsWith(".csv") && (
                <div className="overflow-auto border rounded max-h-72">
                  {csvPreview ? (
                    <table className="min-w-full table-auto text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          {csvPreview
                            .trim()
                            .split("\n")[0]
                            .split(";")
                            .map((h, idx) => (
                              <th key={idx} className="px-2 py-1 text-left">
                                {h}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview
                          .trim()
                          .split("\n")
                          .slice(1)
                          .filter((line) => line.trim().length > 0)
                          .map((line, i) => {
                            const cells = line.split(";");
                            return (
                              <tr
                                key={i}
                                className={i % 2 ? "bg-gray-50" : ""}
                              >
                                {cells.map((cell, j) => (
                                  <td
                                    key={j}
                                    className="px-2 py-1 whitespace-nowrap"
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="p-4 text-gray-600">
                      Chargement de l’aperçu CSV…
                    </p>
                  )}
                </div>
              )}

              {/* Bouton réception partielle */}
              {sel.statut === "partielle" && csvPreview && (
                <button
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                  onClick={() => setShowReception(true)}
                >
                  Réception partielle
                </button>
              )}

              {/* Modale réception partielle */}
              {showReception && (
                <ReceptionPartielleModal
                  lignes={parseCsvLines(csvPreview)}
                  onClose={() => setShowReception(false)}
                  onValide={handleReceptionPartielle}
                  dejaRecues={sel.receivedLines || []}
                />
              )}

              {/* Chat */}
              <div className="border p-2 max-h-48 overflow-y-auto text-sm space-y-2">
                {(sel.messages || []).map((m, i) => (
                  <div key={i}>
                    <span className="font-medium">{m.from}</span>{" "}
                    <span className="text-xs text-gray-500">
                      {new Date(m.at).toLocaleTimeString("fr-FR")}
                    </span>
                    <div>{m.text}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Message…"
                  className="flex-1 border px-2 py-1 rounded"
                />
                <button
                  onClick={send}
                  disabled={!newMsg.trim()}
                  className="bg-green-600 text-white rounded px-4 disabled:opacity-50"
                >
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Composant modale réception partielle ---
function ReceptionPartielleModal({ lignes, onClose, onValide, dejaRecues }) {
  const [checked, setChecked] = useState({});
  const [qteRecue, setQteRecue] = useState({});

  useEffect(() => {
    const preset = {};
    const presetQte = {};
    (dejaRecues || []).forEach((l) => {
      if (l.Ref) {
        preset[l.Ref] = true;
        presetQte[l.Ref] = l.qty;
      }
    });
    setChecked(preset);
    setQteRecue(presetQte);
  }, [dejaRecues]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-[400px]">
        <h2 className="text-lg font-bold mb-2">Réception partielle</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const recues = lignes
              .filter((l) => checked[l.Ref])
              .map((l) => ({
                ...l,
                qty: Number(qteRecue[l.Ref]) || 0,
              }))
              .filter((l) => l.qty > 0);
            onValide(recues);
          }}
        >
          <div className="max-h-60 overflow-auto mb-4">
            {lignes.map((l) => {
              const dejaRecueQty = (dejaRecues || []).find(
                (r) => r.Ref === l.Ref
              )?.qty || 0;
              const deja = dejaRecueQty >= Number(l.qty || 0);
              return (
                <div
                  key={l.Ref || l.Designation || Math.random()}
                  className="flex items-center gap-2 mb-1"
                >
                  <input
                    type="checkbox"
                    checked={!!checked[l.Ref]}
                    disabled={deja}
                    onChange={(e) => {
                      setChecked((c) => ({ ...c, [l.Ref]: e.target.checked }));
                      if (e.target.checked && qteRecue[l.Ref] === undefined) {
                        setQteRecue((q) => ({ ...q, [l.Ref]: l.qty }));
                      }
                    }}
                  />
                  <span>
                    {l.Ref} — {l.Designation}
                    {deja && (
                      <span className="ml-2 text-green-600 text-xs font-semibold">
                        (déjà ajouté)
                      </span>
                    )}
                    {!deja && dejaRecueQty > 0 && (
                      <span className="ml-2 text-orange-600 text-xs font-semibold">
                        (déjà reçu : {dejaRecueQty}/{l.qty})
                      </span>
                    )}
                  </span>
                  {checked[l.Ref] && !deja && (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={Number(l.qty) || 1}
                        value={qteRecue[l.Ref] !== undefined ? qteRecue[l.Ref] : l.qty}
                        onChange={(e) =>
                          setQteRecue((q) => ({
                            ...q,
                            [l.Ref]: e.target.value,
                          }))
                        }
                        className="border px-1 w-16"
                      />
                      <span>/ {l.qty}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="border px-3 py-1 rounded"
            >
              Annuler
            </button>
            <button className="bg-green-600 text-white px-3 py-1 rounded">
              Valider réception
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}