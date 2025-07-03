// pages/history.jsx
import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dynamic from "next/dynamic";
import {
  Package,
  AlertTriangle,
  ShoppingCart,
  DollarSign,
} from "lucide-react";

// -------------- SWR fetcher ----------------
const fetcher = (url) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error("Erreur réseau");
    return r.json();
  });

// ------------- Dynamic imports Recharts ---------------
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(
  () => import("recharts").then((m) => m.LineChart),
  { ssr: false }
);
const Line = dynamic(() => import("recharts").then((m) => m.Line), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), {
  ssr: false,
});
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), {
  ssr: false,
});

// -------------- Utils for chart ----------------
// 1) Génère un tableau de labels "DD/MM" pour les N derniers jours
function getLastNDays(n) {
  const today = new Date();
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(
      d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      })
    );
  }
  return days;
}
// 2) Agrège les logs par jour (format "DD/MM")
function aggregateByDay(data) {
  const map = {};
  data.forEach((log) => {
    const day = new Date(log.timestamp).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
    map[day] = (map[day] || 0) + 1;
  });
  return map;
}

// ------------- KPI Card (pour illustrer, si besoin) ------------
function KpiCard({ icon, title, value }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 flex items-center gap-4">
      <div className="p-3 rounded-full bg-teal-50 text-teal-700">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 3) Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // 4) Load logs
  const { data: logs = [], error } = useSWR(
    status === "authenticated" ? "/api/history" : null,
    fetcher
  );

  // 5) Chart: mounted flag to avoid SSR issues
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 6) UI states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterType, setFilterType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [mode, setMode] = useState("detail"); // "detail" | "resume"
  const [groupBy, setGroupBy] = useState("type");
  const [expandedKey, setExpandedKey] = useState(null);

  // 7) Prepare detail rows
  const detailRows = useMemo(
    () =>
      logs.map((log) => {
        const dt = new Date(log.timestamp);
        return {
          key: log.id || log.timestamp,
          date: dt,
          dateStr: dt.toLocaleString("fr-FR"),
          user: log.user,
          type: log.type,
          ref: log.ref ?? "",
          field: log.field ?? log.statField ?? "",
          oldVal:
            log.oldValue != null ? log.oldValue : log.oldStatus ?? "",
          newVal:
            log.newValue != null ? log.newValue : log.newStatus ?? "",
        };
      }),
    [logs]
  );

  // 8) Filter lists
  const users = useMemo(
    () => Array.from(new Set(detailRows.map((r) => r.user))).sort(),
    [detailRows]
  );
  const types = useMemo(
    () => Array.from(new Set(detailRows.map((r) => r.type))).sort(),
    [detailRows]
  );

  // 9) Filtering logic
  const filtered = useMemo(() => {
    return detailRows.filter((r) => {
      if (filterUser && r.user !== filterUser) return false;
      if (filterType && r.type !== filterType) return false;
      if (searchTerm) {
        const hay = [
          r.dateStr,
          r.user,
          r.type,
          r.ref,
          r.field,
          r.oldVal,
          r.newVal,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(searchTerm.toLowerCase())) return false;
      }
      if (dateFrom && r.date < new Date(dateFrom)) return false;
      if (dateTo && r.date > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [detailRows, filterUser, filterType, searchTerm, dateFrom, dateTo]);

  // 10) Sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      sortAsc ? a.date - b.date : b.date - a.date
    );
  }, [filtered, sortAsc]);

  // 11) Summary mode
  const summary = useMemo(() => {
    if (mode !== "resume") return [];
    const map = {};
    sorted.forEach((r) => {
      const key = r[groupBy] || "(vide)";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([key, count]) => ({ key, count }));
  }, [mode, groupBy, sorted]);

  // 12) Chart data (7 derniers jours)
  const DAYS = 7;
  const labels = useMemo(() => getLastNDays(DAYS), []);
  const agg = useMemo(() => aggregateByDay(sorted), [sorted]);
  const chartData = useMemo(
    () =>
      labels.map((day) => ({
        jour: day,
        actions: agg[day] || 0,
      })),
    [labels, agg]
  );

  // 13) Export CSV
  function exportCSV() {
    const hdr =
      mode === "detail"
        ? ["Date", "Utilisateur", "Type", "Réf", "Champ", "Ancienne", "Nouvelle"]
        : [groupBy === "type" ? "Type" : "Réf", "Nombre"];
    const rows =
      mode === "detail"
        ? sorted.map((r) => [
            r.dateStr,
            r.user,
            r.type,
            r.ref,
            r.field,
            r.oldVal,
            r.newVal,
          ])
        : summary.map((s) => [s.key, s.count]);
    const csv = [
      hdr.join(","),
      ...rows.map((r) =>
        r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historique.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // 14) Export PDF
  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Historique des actions", 14, 20);
    const head =
      mode === "detail"
        ? [["Date", "Utilisateur", "Type", "Réf", "Champ", "Ancienne", "Nouvelle"]]
        : [[groupBy === "type" ? "Type" : "Réf", "Nombre"]];
    const body =
      mode === "detail"
        ? sorted.map((r) => [
            r.dateStr,
            r.user,
            r.type,
            r.ref,
            r.field,
            r.oldVal,
            r.newVal,
          ])
        : summary.map((s) => [s.key, s.count]);
    autoTable(doc, { startY: 30, head, body });
    doc.save("historique.pdf");
  }

  if (status === "loading" || !logs) {
    return <p>Chargement de l’historique…</p>;
  }
  if (error) return <p className="text-red-600">Erreur de chargement</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Historique des actions</h1>

      {/* — FILTRES — */}
      <div className="flex flex-wrap gap-2 items-end">
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option value="">Tous utilisateurs</option>
          {users.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option value="">Tous types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <input
          type="text"
          placeholder="Recherche…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border px-2 py-1 rounded flex-1 min-w-[150px]"
        />
        <button
          onClick={() => setSortAsc((a) => !a)}
          className="border px-3 py-1 rounded hover:bg-gray-200"
        >
          Trier : {sortAsc ? "ancien→récent" : "récent→ancien"}
        </button>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option value="detail">Mode détail</option>
          <option value="resume">Mode résumé</option>
        </select>
        {mode === "resume" && (
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="border px-2 py-1 rounded"
          >
            <option value="type">Grouper par type</option>
            <option value="ref">Grouper par référence</option>
          </select>
        )}
        <button
          onClick={exportCSV}
          className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
        >
          Export CSV
        </button>
        <button
          onClick={exportPDF}
          className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700"
        >
          Export PDF
        </button>
      </div>

      {/* — TABLEAU — */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              {mode === "detail" ? (
                ["Date","Utilisateur","Type","Réf","Champ","Ancienne","Nouvelle",""].map((h) => (
                  <th key={h} className="px-2 py-1 text-left">
                    {h}
                  </th>
                ))
              ) : (
                [groupBy === "type" ? "Type" : "Réf","Nombre",""].map((h) => (
                  <th key={h} className="px-2 py-1 text-left">
                    {h}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {(mode === "detail" ? sorted : summary).map((r, i) => {
              const key = mode === "detail" ? r.key : r.key;
              return (
                <React.Fragment key={key + i}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      setExpandedKey((exp) => (exp === key ? null : key))
                    }
                  >
                    {mode === "detail" ? (
                      <>
                        <td className="px-2 py-1">{r.dateStr}</td>
                        <td className="px-2 py-1">{r.user}</td>
                        <td className="px-2 py-1">{r.type}</td>
                        <td className="px-2 py-1">{r.ref}</td>
                        <td className="px-2 py-1">{r.field}</td>
                        <td className="px-2 py-1">
                          {typeof r.oldVal === "object" && r.oldVal !== null
                            ? JSON.stringify(r.oldVal)
                            : r.oldVal}
                        </td>
                        <td className="px-2 py-1">
                          {typeof r.newVal === "object" && r.newVal !== null
                            ? JSON.stringify(r.newVal)
                            : r.newVal}
                        </td>
                        <td className="px-2 py-1 text-center">⌄</td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1">{r.key}</td>
                        <td className="px-2 py-1">{r.count}</td>
                        <td className="px-2 py-1 text-center">⌄</td>
                      </>
                    )}
                  </tr>

                  {/* détails contextuels */}
                  {expandedKey === key && mode === "detail" && (
                    <tr className="bg-gray-50">
                      <td
                        colSpan={8}
                        className="px-4 py-2 text-sm text-gray-600"
                      >
                        <p>
                          <strong>Ancienne valeur :</strong> {r.oldVal}
                        </p>
                        <p>
                          <strong>Nouvelle valeur :</strong> {r.newVal}
                        </p>
                        {r.type.startsWith("stock") && (
                          <Link
                            href={{
                              pathname: "/stock",
                              query: { ref: r.ref, highlight: "1" },
                            }}
                            className="text-blue-600 hover:underline"
                          >
                            Voir le stock
                          </Link>
                        )}
                        {r.type.startsWith("order") && (
                          <Link
                            href="/commandes"
                            className="text-blue-600 hover:underline ml-4"
                          >
                            Voir les commandes
                          </Link>
                        )}
                      </td>
                    </tr>
                  )}
                  {expandedKey === key && mode === "resume" && (
                    <tr className="bg-gray-50">
                      <td
                        colSpan={3}
                        className="px-4 py-2 text-sm text-gray-600"
                      >
                        <strong>{r.key}</strong> : {r.count} action(s)
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
