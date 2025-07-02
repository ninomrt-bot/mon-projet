import { readFile } from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  const { file } = req.query;
  const filePath = path.join(process.cwd(), 'uploads', file);
  try {
    const data = await readFile(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(data);
  } catch {
    res.status(404).end('Not found');
  }
}
