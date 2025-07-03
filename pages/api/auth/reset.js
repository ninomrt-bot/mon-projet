
import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";

import bcrypt from "bcryptjs";
import { USERS } from "../../../data/users.sample";

import { consumeResetToken, setPasswordHash } from "../../../lib/loginSecurity";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: "token or password missing" });

  const userId = consumeResetToken(token);
  if (!userId) return res.status(400).json({ error: "invalid token" });


  const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
  if (!user) return res.status(400).json({ error: "user not found" });

  const hash = await bcrypt.hash(password, 10);
  setPasswordHash(String(user.id), hash);

  const user = USERS.find(u => u.id === userId);
  if (!user) return res.status(400).json({ error: "user not found" });

  const hash = await bcrypt.hash(password, 10);
  setPasswordHash(user.id, hash);


  res.status(200).json({ ok: true });
}

export const config = { api: { bodyParser: true } };
