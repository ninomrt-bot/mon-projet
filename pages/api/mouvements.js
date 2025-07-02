import { writeFile, readFile } from "fs/promises";
import path from "path";

async function logStockUpdate({ ref, oldValue, newValue, user }) {
  const histPath = path.join(process.cwd(), "data", "stockHistory.json");
  let history = [];
  try {
    history = JSON.parse(await readFile(histPath, "utf8")) || [];
  } catch {
    history = [];
  }
  history.push({
    type: "stock_update",
    field: "Qte stock",
    ref,
    oldValue,
    newValue,
    user,
    timestamp: new Date().toISOString(),
  });
  await writeFile(histPath, JSON.stringify(history, null, 2), "utf8");
}

export default async function handler(req, res) {
  const { type } = req.query;  // "entree" ou "sortie"
  const histPath = path.join(process.cwd(), "data", "stockHistory.json");

  let history = [];
  try {
    history = JSON.parse(await readFile(histPath, "utf8")) || [];
  } catch {
    history = [];
  }

  // Garde seulement les mises à jour de la Qte stock
  const stockUpdates = history.filter(
    (e) => e.type === "stock_update" && e.field === "Qte stock"
  );

  // Transforme en { date, delta }
  const moves = stockUpdates.map((e) => ({
    date: e.timestamp,
    delta: Number(e.newValue) - Number(e.oldValue),
  }));

  // Filtre selon le type et renvoie { date, valeur }
  const filtered = moves
    .filter((m) => (type === "entree" ? m.delta > 0 : m.delta < 0))
    .map((m) => ({
      date: m.date,
      valeur: Math.abs(m.delta),
    }));

  // Désactive le cache HTTP
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(filtered);
}
