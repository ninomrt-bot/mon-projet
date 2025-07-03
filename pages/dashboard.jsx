// pages/dashboard.jsx
import React, { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Package,
  AlertTriangle,
  ShoppingCart,
  DollarSign,
} from 'lucide-react';

const fetcher = url =>
  fetch(url, { cache: 'no-store' }).then(r => r.json());

// 1) Génère un tableau de labels "DD/MM" pour les N derniers jours
function getLastNDays(n) {
  const today = new Date();
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(
      d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
      })
    );
  }
  return days;
}

// 2) Agrège les mouvements bruts par jour
function aggregateByDay(data) {
  const map = {};
  data.forEach(m => {
    const key = new Date(m.date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    });
    map[key] = (map[key] || 0) + Number(m.valeur ?? 0);
  });
  return map;
}

// Composant KPI
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

export default function DashboardPage() {
  // Pour éviter le SSR + Recharts
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Chargement des données
  const { data: stockRaw = [], error: stockError } = useSWR('/api/stock', fetcher);
  const { data: commandesRaw = [], error: commandesError } = useSWR('/api/commandes', fetcher);
  const { data: entreesRaw = [], error: entreesError } = useSWR(
    '/api/mouvements?type=entree',
    fetcher
  );
  const { data: sortiesRaw = [], error: sortiesError } = useSWR(
    '/api/mouvements?type=sortie',
    fetcher
  );

  if (stockError) return <p>Erreur de chargement du stock.</p>;
  if (commandesError) return <p>Erreur de chargement des commandes.</p>;
  if (entreesError) return <p>Erreur de chargement des entrées.</p>;
  if (sortiesError) return <p>Erreur de chargement des sorties.</p>;

  // Préparation du stock + KPI
  const stock = useMemo(
    () =>
      Array.isArray(stockRaw)
        ? stockRaw.map(r => ({
            ...r,
            qteStock: Number(r['Qte stock'] ?? 0),
            qteMini: Number(r['Qte mini'] ?? 0),
            enCommande: Number(r['En Commande'] ?? 0),
          }))
        : [],
    [stockRaw]
  );
  const alerts = useMemo(
    () =>
      stock
        .map(r => {
          const manque = r.qteMini - (r.qteStock + r.enCommande);
          return manque > 0 ? { ...r, toOrder: manque } : null;
        })
        .filter(Boolean),
    [stock]
  );
  const kpi = useMemo(() => {
    const totalItems = stock.length;
    const lowStock = alerts.length;
    const pendingPOs = commandesRaw.filter(
      po => po.statut === 'en cours'
    ).length;
    const stockValue = stock.reduce(
      (sum, r) => sum + Number(r['PU HT'] ?? 0) * r.qteStock,
      0
    );
    return { totalItems, lowStock, pendingPOs, stockValue };
  }, [stock, alerts, commandesRaw]);

  // Agrégation journalière pour le graphique
  const aggEntrees = useMemo(
    () => aggregateByDay(entreesRaw),
    [entreesRaw]
  );
  const aggSorties = useMemo(
    () => aggregateByDay(sortiesRaw),
    [sortiesRaw]
  );

  // Prépare les 7 derniers jours
  const DAYS_TO_SHOW = 7;
  const labels = useMemo(() => getLastNDays(DAYS_TO_SHOW), []);
  const combined = useMemo(
    () =>
      labels.map(day => ({
        jour: day,
        entrees: aggEntrees[day] || 0,
        sorties: aggSorties[day] || 0,
      })),
    [labels, aggEntrees, aggSorties]
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-6">
      {/* KPI */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard
          icon={<Package className="h-6 w-6" />}
          title="Articles totaux"
          value={kpi.totalItems}
        />
        <KpiCard
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Sous le minimum"
          value={kpi.lowStock}
        />
        <KpiCard
          icon={<ShoppingCart className="h-6 w-6" />}
          title="BC en attente"
          value={kpi.pendingPOs}
        />
        <KpiCard
          icon={<DollarSign className="h-6 w-6" />}
          title="Valorisation"
          value={kpi.stockValue.toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0,
          })}
        />
      </section>

      {/* Entrées vs Sorties (7 derniers jours) */}
      <div className="bg-white rounded-2xl shadow p-4">
        <h2 className="text-lg font-medium mb-4">
          Entrées/Sorties (dernier {DAYS_TO_SHOW} jours)
        </h2>
        <div className="h-80">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={combined}
                margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="jour" />
                <YAxis allowDecimals={false} domain={[0, 'auto']} />
                <Tooltip />
                <Legend verticalAlign="top" height={36} />
                <Line
                  type="monotone"
                  dataKey="entrees"
                  name="Entrées"
                  stroke="#00a6b2"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="sorties"
                  name="Sorties"
                  stroke="#ff5c5c"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500">Chargement…</p>
          )}
        </div>
      </div>
    </div>
  );
}
