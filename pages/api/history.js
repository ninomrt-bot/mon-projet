// pages/api/history.js
import { readFile } from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  try {
    const file = path.join(process.cwd(), 'data', 'stockHistory.json');
    const content = await readFile(file, 'utf8').catch(() => '[]');
    const history = JSON.parse(content);
    return res.status(200).json(history);
  } catch (err) {
    console.error('API /api/history erreur :', err);
    return res.status(500).json({ error: 'Impossible de charger l’historique' });
  }
}
