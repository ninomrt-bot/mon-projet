// pages/api/stock.js
import { readFile, writeFile } from "fs/promises";
import path from "path";
import XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { logStockUpdate } from "./mouvements"; // adapte le chemin si besoin

const STOCK_FILE   = path.join(process.cwd(), "public", "Stock.xlsm");
const HISTORY_FILE = path.join(process.cwd(), "data",   "stockHistory.json");

// ────────────────────────────────────────────────────────────────────────
// util : ajoute une entrée au fichier d’historique
async function appendHistory(entry) {
  let history = [];
  try {
    history = JSON.parse(await readFile(HISTORY_FILE, "utf8"));
    if (!Array.isArray(history)) history = [];
  } catch (_) {
    history = [];
  }
  history.push(entry);
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}
// Champs numériques pour conversion systématique
const QTY_FIELDS = ["Qte stock", "Qte mini", "En Commande"];

// ────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // 1) Authentification
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Non authentifié" });
  const user = session.user.name;

  // 2) Lecture du classeur
  const buffer   = await readFile(STOCK_FILE);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNm  = workbook.SheetNames[0];
  const sheet    = workbook.Sheets[sheetNm];

  // defval : 0 pour éviter les "" sur les champs numériques
  let rows = XLSX.utils.sheet_to_json(sheet, { defval: 0, range: 0 });

  // Mise à niveau : s’assure que chaque ligne possède la colonne « En Commande »
  rows.forEach(r => { if (!("En Commande" in r)) r["En Commande"] = 0; });

  // ── GET : récupérer tout le stock
  if (req.method === "GET") {
    return res.status(200).json(rows);
  }

  // ── POST : créer une nouvelle ligne ----------------------------------
  if (req.method === "POST") {
    const {
      Marque        = "",
      Ref           = "",
      Désignation   = "",
      Fournisseurs  = "",
      "Qte stock": qteStock = 0,
      "Qte mini":  qteMini  = 0,
      "En Commande": enCmd  = 0
    } = req.body;

    const newRow = {
      Marque,
      Ref,
      Désignation,
      Fournisseurs,
      "Qte stock": Number(qteStock) || 0,
      "Qte mini":  Number(qteMini)  || 0,
      "En Commande": Number(enCmd)  || 0
    };
    rows.push(newRow);

    // Écriture Excel
    workbook.Sheets[sheetNm] = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    await writeFile(
      STOCK_FILE,
      XLSX.write(workbook, { bookType: "xlsm", type: "buffer" })
    );

    // Journalisation
    await appendHistory({
      id: uuidv4(), type: "stock_create", ref: Ref,
      field: null, oldValue: null, newValue: newRow,
      user, timestamp: new Date().toISOString()
    });

    return res.status(201).json(newRow);
  }

  // ── PUT : mettre à jour une cellule ----------------------------------
  if (req.method === "PUT") {
    const { Ref, field, value } = req.body;
    const idx = rows.findIndex(r => String(r.Ref) === String(Ref));
    if (idx === -1) return res.status(404).json({ error: "Réf introuvable" });

    const oldValue = rows[idx][field];
    rows[idx][field] =
      QTY_FIELDS.includes(field) ? Number(value) || 0 : value;

    workbook.Sheets[sheetNm] = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    await writeFile(
      STOCK_FILE,
      XLSX.write(workbook, { bookType: "xlsm", type: "buffer" })
    );

    await appendHistory({
      id: uuidv4(), type: "stock_update", ref: Ref,
      field, oldValue, newValue: rows[idx][field],
      user, timestamp: new Date().toISOString()
    });

    // Ajoute dans l'historique des mouvements SI c'est une modification de Qte stock
    if (field === "Qte stock") {
      await appendHistory({
        id: uuidv4(), type: "stock_update", ref: Ref,
        field: "Qte stock", oldValue, newValue: rows[idx][field],
        user, timestamp: new Date().toISOString()
      });
      await logStockUpdate({
        ref: Ref,
        oldValue: oldValue,
        newValue: rows[idx][field],
        user: user || "Système",
      });
    }

    return res.status(200).json(rows[idx]);
  }

  // ── DELETE : enlever une ligne ---------------------------------------
  if (req.method === "DELETE") {
    const { Ref } = req.query;
    const idx = rows.findIndex(r => String(r.Ref) === String(Ref));
    if (idx === -1) return res.status(404).json({ error: "Réf introuvable" });

    const deletedRow = rows.splice(idx, 1)[0];

    workbook.Sheets[sheetNm] = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    await writeFile(
      STOCK_FILE,
      XLSX.write(workbook, { bookType: "xlsm", type: "buffer" })
    );

    await appendHistory({
      id: uuidv4(), type: "stock_delete", ref: Ref,
      field: null, oldValue: deletedRow, newValue: null,
      user, timestamp: new Date().toISOString()
    });

    return res.status(204).end();
  }

  // ── Méthode non supportée -------------------------------------------
  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).end();
}