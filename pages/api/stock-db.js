import prisma from "../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Non authentifié" });

  if (req.method === "GET") {
    try {
      const data = await prisma.stockItem.findMany();
      return res.status(200).json(data);
    } catch (err) {
      console.error("Erreur Prisma :", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }

  return res.status(405).json({ error: "Méthode non supportée" });
}
