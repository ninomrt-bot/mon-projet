import prisma from '../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const products = await prisma.product.findMany();
    return res.json(products);
  }

  if (req.method === 'POST') {
    const { name, quantity } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const product = await prisma.product.create({ data: { name, quantity: quantity || 0 } });
    return res.status(201).json(product);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end();
}

export const config = { api: { bodyParser: true } };
