// pages/api/commandes.js
import { promises as fs } from "fs";
import path from "path";
import formidable from "formidable";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { USERS } from "./auth/[...nextauth]";

const DATA_PATH   = path.join(process.cwd(), "data", "commandes.json");
const UPLOAD_DIR  = path.join(process.cwd(), "public", "uploads");
const HISTORY_FILE = path.join(process.cwd(), "data", "stockHistory.json");

// Helper pour lire/écrire le JSON
async function readCommandes() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const arr = JSON.parse(raw);
    return arr.map(c => ({
      messages:     c.messages || [],
      statut:       c.statut   || "En cours",
      comment:      c.comment  || null,
      creatorEmail: c.creatorEmail || null,
      ...c
    }));
  } catch {
    return [];
  }
}

async function writeCommandes(data) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

// Helper pour journaliser les modifications (ordre)
async function appendHistory(entry) {
  try {
    const content = await fs.readFile(HISTORY_FILE, "utf8").catch(() => "[]");
    const history = JSON.parse(content);
    history.push(entry);
    await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error("Erreur écriture historique :", e);
  }
}

// Désactive le bodyParser intégré (pour formidable POST)
export const config = { api: { bodyParser: false } };

// Pour récupérer le body brut en PUT
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", chunk => (buf += chunk));
    req.on("end", () => resolve(buf));
    req.on("error", err => reject(err));
  });
}

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  host:   "smtp.gmail.com",
  port:   465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

transporter.verify()
  .then(() => console.log("✅ SMTP prêt à envoyer"))
  .catch(err => console.error("❌ Erreur SMTP:", err));

export default async function handler(req, res) {
  // 1) Authentification
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Non authentifié" });
  }
  const userName  = session.user.name;
  const userEmail = session.user.email;

  // 2) Charger les commandes
  const commandes = await readCommandes();

  // === GET : renvoyer toutes ===
  if (req.method === "GET") {
    return res.status(200).json(commandes);
  }

  // === POST : création + upload PDF ===
  if (req.method === "POST") {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const form = formidable({ uploadDir: UPLOAD_DIR, keepExtensions: true });
    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(500).send(err.message);

      const f   = Array.isArray(files.file) ? files.file[0] : files.file;
      const url = `/uploads/${f.newFilename}`;

      const cmd = {
        id:           Date.now().toString(),
        filename:     f.originalFilename,
        url,
        statut:       "En cours",
        createdAt:    new Date().toISOString(),
        creator:      userName,
        creatorEmail: userEmail,
        comment:      null,
        messages:     [],
      };

      commandes.push(cmd);
      await writeCommandes(commandes);
      res.status(201).json(cmd);
    });
    return;
  }

  // === PUT : mise à jour statut/comment/chat + mail + audit ===
  if (req.method === "PUT") {
    try {
      const raw = await getRawBody(req);
      const { id, statut, comment, newMessage } = JSON.parse(raw);

      const idx = commandes.findIndex(c => c.id === id);
      if (idx === -1) {
        return res.status(404).send("Commande introuvable");
      }

      // Sauvegarde de l'ancien statut pour l'audit
      const oldStatut = commandes[idx].statut;

      // Mise à jour mémoire
      commandes[idx].statut = statut;
      if (statut === "Partiellement reçue" && comment) {
        commandes[idx].comment = comment;
      }
      if (newMessage) {
        commandes[idx].messages.push({
          from: newMessage.from,
          text: newMessage.text,
          at:   newMessage.at,
        });
      }

      // Journaliser le changement de statut
      await appendHistory({
        id:        uuidv4(),
        type:      'order_update',
        orderId:   id,
        oldStatus: oldStatut,
        newStatus: statut,
        user:      userName,
        timestamp: new Date().toISOString(),
      });

      // Envoi email si reçue
      const recipient = commandes[idx].creatorEmail || 
        USERS.find(u => u.name === commandes[idx].creator)?.email;
      if (statut === "Reçue" && recipient) {
        transporter.sendMail({
          from:    `"Stock App" <${process.env.SMTP_USER}>`,
          to:      recipient,
          subject: `✅ Votre commande "${commandes[idx].filename}" est reçue`,
          text:    `Bonjour ${commandes[idx].creator},\n\nVotre commande "${commandes[idx].filename}" est maintenant marquée \"Reçue\".\n\nBonne journée !`,
        })
        .then(() => console.log("Mail envoyé ✔️"))
        .catch(err => console.error("Erreur SMTP, on continue :", err));
      }

      // Persister modifications
      await writeCommandes(commandes);
      return res.status(200).json(commandes[idx]);
    } catch (err) {
      console.error("Erreur PUT /api/commandes :", err);
      return res.status(400).send("JSON invalide ou erreur interne");
    }
  }

  // === DELETE ===
  if (req.method === "DELETE") {
    const { id } = req.query;
    const i = commandes.findIndex(c => c.id === id);
    if (i === -1) return res.status(404).send("Commande introuvable");

    const toDelete = commandes[i];
    await fs.unlink(path.join(process.cwd(), 'public', toDelete.url));
    commandes.splice(i,1);
    await writeCommandes(commandes);
    return res.status(204).end();
  }

  res.setHeader('Allow',['GET','POST','PUT','DELETE']);
  return res.status(405).end();
}
