import prisma from '../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    const history = await prisma.history.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json(history);
  }

  res.setHeader('Allow', ['GET']);
  res.status(405).end();
}
