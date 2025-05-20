// pages/commandes.jsx
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import useSWR from "swr";
import { PaperClipIcon, TrashIcon } from "@heroicons/react/24/solid";

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function CommandesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 1) Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);
  if (status === "loading") return <div>Chargement…</div>;
  if (status === "unauthenticated") return null;

  // 2) Load commandes and set up state
  const { data: items, error, mutate } = useSWR("/api/commandes", fetcher);
  const [columns, setColumns] = useState({
    "En cours": [],
    "Partiellement reçue": [],
    Reçue: [],
  });
  const [file, setFile] = useState(null);
  const [selected, setSelected] = useState(null);
  const [newMsg, setNewMsg] = useState("");

  useEffect(() => {
    if (!items) return;
    setColumns({
      "En cours": items.filter((i) => i.statut === "En cours"),
      "Partiellement reçue": items.filter((i) => i.statut === "Partiellement reçue"),
      Reçue: items.filter((i) => i.statut === "Reçue"),
    });
  }, [items]);

  if (error) return <div>Erreur de chargement</div>;
  if (!items) return <div>Chargement des commandes…</div>;

  // 3) Upload PDF
  const onUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    await fetch("/api/commandes", { method: "POST", body: form });
    setFile(null);
    mutate();
  };

  // 4) Drag & Drop handlers
  const handleDragStart = (id) => (e) => {
    e.dataTransfer.setData("text/plain", id);
  };
  const handleDrop = newStatut => async e => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    await fetch('/api/commandes', {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ id, statut: newStatut })
    })
    mutate()
  }
  

  // 5) Send chat message
  const sendMessage = async () => {
    if (!newMsg.trim() || !selected) return;
    await fetch("/api/commandes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.id,
        statut: selected.statut, // keep existing statut
        newMessage: {
          from: session.user.name,
          text: newMsg.trim(),
          at: new Date().toISOString(),
        },
      }),
    });
    setNewMsg("");
    // re-fetch and update selected
    const updated = await fetcher("/api/commandes");
    mutate(updated, false);
    setSelected(updated.find((c) => c.id === selected.id));
  };

  // 6) Delete a commande
  const deleteCmd = async (id) => {
    if (!confirm("Supprimer cette commande ?")) return;
    await fetch(`/api/commandes?id=${id}`, { method: "DELETE" });
    mutate();
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header + Upload */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gestion des Commandes</h1>
        <span className="font-medium">{}</span>
      </div>
      <form onSubmit={onUpload} className="flex gap-2 items-center">
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files[0])}
          className="border p-1"
        />
        <button
          type="submit"
          disabled={!file}
          className="bg-blue-600 text-white py-1 px-3 rounded disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>

      {/* Kanban columns */}
      <div className="flex gap-4">
        {Object.entries(columns).map(([colId, list]) => (
          <div
            key={colId}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop(colId)}
            className="flex-1 bg-blue-50 rounded p-3 min-h-[400px] space-y-2"
          >
            <h2 className="font-semibold mb-2">{colId}</h2>
            {list.map((cmd) => (
              <div
                key={cmd.id}
                draggable
                onDragStart={handleDragStart(cmd.id)}
                onClick={() => {
                  setSelected(cmd);
                  setNewMsg("");
                }}
                className="bg-white rounded shadow p-3 space-y-1 cursor-move relative"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCmd(cmd.id);
                  }}
                  className="absolute top-1 right-1 text-red-500"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
                <div className="flex justify-between">
                  <span className="text-sm">{cmd.filename}</span>
                  <PaperClipIcon className="h-4 w-4 text-gray-500" />
                </div>
                <div className="text-xs text-gray-500">Créé par {cmd.creator}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Detail Modal + Chat */}
      {selected && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-lg overflow-hidden max-w-xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">{selected.filename}</h2>
              <button onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="p-4 space-y-4">
              <p>
                <strong>Statut :</strong> {selected.statut}
              </p>
              {selected.comment && (
                <p>
                  <strong>Commentaire :</strong> {selected.comment}
                </p>
              )}
              <p>
                <strong>Créé par :</strong> {selected.creator} —{" "}
                <time dateTime={selected.createdAt}>
                  {new Date(selected.createdAt).toLocaleString("fr-FR")}
                </time>
              </p>

              {/* PDF preview */}
              <div className="h-80 border">
                <object
                  data={selected.url}
                  type="application/pdf"
                  width="100%"
                  height="100%"
                >
                  PDF non supporté
                </object>
              </div>

              {/* Chat history */}
              <div className="max-h-48 overflow-y-auto space-y-2 border p-2">
                {(selected.messages || []).map((m, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium">{m.from}</span>{" "}
                    <span className="text-gray-500 text-xs">
                      ({new Date(m.at).toLocaleTimeString("fr-FR")})
                    </span>
                    <div>{m.text}</div>
                  </div>
                ))}
              </div>

              {/* Chat input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Ajouter un message…"
                  className="flex-1 border px-2 py-1 rounded"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMsg.trim()}
                  className="bg-green-600 text-white px-4 rounded disabled:opacity-50"
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
