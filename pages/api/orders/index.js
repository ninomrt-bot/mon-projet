import prisma from '../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const orders = await prisma.order.findMany({ include: { items: true } });
    return res.json(orders);
  }

  if (req.method === 'POST') {
    const { type, items } = req.body || {};
    if (!type || !Array.isArray(items)) return res.status(400).json({ error: 'invalid payload' });
    const order = await prisma.order.create({
      data: {
        type,
        user: { connect: { email: session.user.email } },
        items: { create: items.map(i => ({ productId: i.productId, quantity: i.quantity })) },
      },
      include: { items: true },
    });
    return res.status(201).json(order);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end();
}

export const config = { api: { bodyParser: true } };
