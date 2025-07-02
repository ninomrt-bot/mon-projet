// pages/api/projects/index.js
import fs from "fs/promises";
import path from "path";

export default async function handler(req, res) {
  try {
    const dir   = path.join(process.cwd(), "public", "nomenclature");
    const files = await fs.readdir(dir);
    const projects = files
      .filter(f => /\.(xls|xlsx|xlsm)$/i.test(f))
      .map(f => ({
        slug: f.replace(/\.(xls|xlsx|xlsm)$/i, ""),
        file: f,
      }));
    res.status(200).json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de lister les projets" });
  }
}
