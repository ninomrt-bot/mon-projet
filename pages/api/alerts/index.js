import prisma from '../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const alerts = await prisma.alert.findMany({ include: { product: true } });
    return res.json(alerts);
  }

  if (req.method === 'POST') {
    const { productId, threshold } = req.body || {};
    if (!productId || typeof threshold !== 'number') return res.status(400).json({ error: 'invalid payload' });
    const alert = await prisma.alert.create({ data: { productId, threshold } });
    return res.status(201).json(alert);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end();
}

export const config = { api: { bodyParser: true } };
