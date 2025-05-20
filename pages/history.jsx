// pages/history.jsx
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

const fetcher = (url) => fetch(url).then((r) => r.json());

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { data: logs, error } = useSWR("/api/history", fetcher);

  // filtres & tri
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterType, setFilterType] = useState("");
  const [sortAsc, setSortAsc] = useState(false); // false = du plus récent au plus ancien

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const rows = useMemo(() => {
    if (!logs) return [];
    return logs.map(log => {
      const date    = new Date(log.timestamp);
      const dateStr = date.toLocaleString();
      const user    = log.user;
      const type    = log.type || (log.orderId ? "order_update" : "stock_update");
      const ref     = log.ref ?? log.orderId ?? "";
      const field   = log.field ?? log.statField ?? "";
      const rawOld  = log.oldValue  ?? log.oldStatus  ?? "";
      const rawNew  = log.newValue  ?? log.newStatus  ?? "";
      const oldVal  = typeof rawOld === "object" ? JSON.stringify(rawOld) : rawOld;
      const newVal  = typeof rawNew === "object" ? JSON.stringify(rawNew) : rawNew;
      return { date, dateStr, user, type, ref, field, oldVal, newVal };
    });
  }, [logs]);

  const users = useMemo(() => Array.from(new Set(rows.map(r => r.user))).sort(), [rows]);
  const types = useMemo(() => Array.from(new Set(rows.map(r => r.type))).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterUser && r.user !== filterUser) return false;
      if (filterType && r.type !== filterType) return false;
      if (searchTerm) {
        const hay = `${r.dateStr} ${r.user} ${r.type} ${r.ref} ${r.field} ${r.oldVal} ${r.newVal}`.toLowerCase();
        if (!hay.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, filterUser, filterType, searchTerm]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      sortAsc ? a.date - b.date : b.date - a.date
    );
  }, [filtered, sortAsc]);

  // export CSV
  const headers = ["Date","Utilisateur","Type","Réf/ID","Champ","Ancienne valeur","Nouvelle valeur"];
  function exportCSV() {
    const csvHeader = headers.join(",");
    const csvRows = sorted.map(r =>
      [r.dateStr, r.user, r.type, r.ref, r.field, r.oldVal, r.newVal]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([csvHeader + "\n" + csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historique.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (status === "loading")         return <div>Chargement…</div>;
  if (status === "unauthenticated") return null;
  if (error)                        return <div>Erreur de chargement</div>;
  if (!logs)                        return <div>Chargement historique…</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Historique des actions</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/stock">
          <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Stock</button>
        </Link>
        <Link href="/commandes">
          <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Commandes</button>
        </Link>
        <Link href="/alertes">
          <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Alertes</button>
        </Link>

        <select
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option value="">Tous utilisateurs</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option value="">Tous types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <input
          type="text"
          placeholder="Recherche libre…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="border px-2 py-1 rounded flex-1 min-w-[150px]"
        />

        <button
          onClick={() => setSortAsc(a => !a)}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Trier : {sortAsc ? "ancien → récent" : "récent → ancien"}
        </button>

        <button
          onClick={exportCSV}
          className="ml-auto bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              {headers.map(h => (
                <th key={h} className="border px-2 py-1 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="border px-2 py-1">{r.dateStr}</td>
                <td className="border px-2 py-1">{r.user}</td>
                <td className="border px-2 py-1">{r.type}</td>
                <td className="border px-2 py-1">{r.ref}</td>
                <td className="border px-2 py-1">{r.field}</td>
                <td className="border px-2 py-1">{r.oldVal}</td>
                <td className="border px-2 py-1">{r.newVal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
