// pages/api/projects/[slug].js
import fs from "fs/promises";
import path from "path";
import XLSX from "xlsx";

export default async function handler(req, res) {
  const { slug } = req.query;
  const dir      = path.join(process.cwd(), "public", "nomenclature");

  try {
    const files = await fs.readdir(dir);
    const file  = files.find(f => f.replace(/\.(xls|xlsx|xlsm)$/i, "") === slug);
    if (!file) return res.status(404).json({ error: `Projet "${slug}" introuvable` });

    const buf      = await fs.readFile(path.join(dir, file));
    const workbook = XLSX.read(buf, { type: "buffer", bookType: "xlsm", WTF: true });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // On trouve dynamiquement les colonnes "Ref" (ou Matériel) et "Quantité"
    const keys   = Object.keys(rows[0] || {});
    const refKey = keys.find(k => /ref(erence)?|mat(ériel)?/i.test(k));
    const qteKey = keys.find(k => /^(quantit|qte|min)/i.test(k));

    if (!refKey || !qteKey) {
      return res
        .status(400)
        .json({ error: `Colonnes "Ref" et "Quantité" non trouvées (${keys.join(", ")})` });
    }

    const components = rows
      .filter(r => r[refKey])
      .map(r => ({
        Ref: String(r[refKey]).trim(),
        qte: Number(r[qteKey]) || 0,
      }));

    res.status(200).json({ slug, components });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors du chargement" });
  }
}
