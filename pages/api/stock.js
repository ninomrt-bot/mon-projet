// pages/api/stock.js
import { readFile, writeFile } from "fs/promises";
import path from "path";
import XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

const STOCK_FILE   = path.join(process.cwd(), "public",  "Stock.xlsm");
const HISTORY_FILE = path.join(process.cwd(), "data",    "stockHistory.json");

// Ajoute une entrée dans le journal des modifications
async function appendHistory(entry) {
  let history = [];
  try {
    const content = await readFile(HISTORY_FILE, "utf8");
    history = JSON.parse(content);
    if (!Array.isArray(history)) history = [];
  } catch (e) {
    // if the file doesn't exist or JSON is malformed,
    // we just start a fresh history array
    history = [];
  }
  history.push(entry);
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

export default async function handler(req, res) {
  // 1) Authentification
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  const user = session.user.name;

  // 2) Lecture du fichier Excel
  const buffer   = await readFile(STOCK_FILE);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNm  = workbook.SheetNames[0];
  const sheet    = workbook.Sheets[sheetNm];
  const rows     = XLSX.utils.sheet_to_json(sheet, { defval: "", range: 0 });

  // GET : renvoyer tout le stock
  if (req.method === "GET") {
    return res.status(200).json(rows);
  }

  // POST : création d’une nouvelle ligne
  if (req.method === "POST") {
    const {
      Marque,
      Ref,
      Désignation,
      Fournisseurs,
      "Qte stock": qteStock,
      "Qte mini":  qteMini
    } = req.body;

    // 1) Ajout en mémoire
    const newRow = { Marque, Ref, Désignation, Fournisseurs, "Qte stock": qteStock, "Qte mini": qteMini };
    rows.push(newRow);

    // 2) Reconstruction de la feuille Excel
    const newSheet = XLSX.utils.json_to_sheet(rows, {
      header: Object.keys(rows[0]),
      skipHeader: false
    });
    workbook.Sheets[sheetNm] = newSheet;

    // 3) Écriture du fichier
    const out = XLSX.write(workbook, { bookType: "xlsm", type: "buffer" });
    await writeFile(STOCK_FILE, out);

    // 4) Journalisation
    await appendHistory({
      id:        uuidv4(),
      type:      "stock_create",
      ref:       Ref,
      field:     null,
      oldValue:  null,
      newValue:  newRow,
      user,
      timestamp: new Date().toISOString()
    });

    return res.status(201).json(newRow);
  }

  // PUT : mise à jour d’une cellule
  if (req.method === "PUT") {
    const { Ref, field, value } = req.body;
    const idx = rows.findIndex(r => String(r.Ref) === String(Ref));
    if (idx === -1) {
      return res.status(404).json({ error: "Réf introuvable" });
    }

    const oldValue = rows[idx][field];
    rows[idx][field] = value;

    // Reconstruire la feuille
    const updatedSheet = XLSX.utils.json_to_sheet(rows, {
      header: Object.keys(rows[0]),
      skipHeader: false
    });
    workbook.Sheets[sheetNm] = updatedSheet;
    const outBuf = XLSX.write(workbook, { bookType: "xlsm", type: "buffer" });
    await writeFile(STOCK_FILE, outBuf);

    // Journaliser la modification
    await appendHistory({
      id:        uuidv4(),
      type:      "stock_update",
      ref:       Ref,
      field,
      oldValue,
      newValue:  value,
      user,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json(rows[idx]);
  }

  // DELETE : suppression d’une ligne par Ref
  if (req.method === "DELETE") {
    const { Ref } = req.query;
    const idx = rows.findIndex(r => String(r.Ref) === String(Ref));
    if (idx === -1) {
      return res.status(404).json({ error: "Réf introuvable" });
    }
    const deletedRow = rows.splice(idx, 1)[0];

    // Reconstruire la feuille
    const newSheet = XLSX.utils.json_to_sheet(rows, {
      header: Object.keys(rows[0]),
      skipHeader: false
    });
    workbook.Sheets[sheetNm] = newSheet;
    const outBuf = XLSX.write(workbook, { bookType: "xlsm", type: "buffer" });
    await writeFile(STOCK_FILE, outBuf);

    // Journaliser la suppression
    await appendHistory({
      id:        uuidv4(),
      type:      "stock_delete",
      ref:       Ref,
      field:     null,
      oldValue:  deletedRow,
      newValue:  null,
      user,
      timestamp: new Date().toISOString()
    });

    return res.status(204).end();
  }

  // Méthode non supportée
  res.setHeader("Allow", ["GET","POST","PUT","DELETE"]);
  return res.status(405).end();
}
