/* pages/api/commandes.js -------------------------------------------------- */
import { promises as fs } from "fs";
import path               from "path";
import formidable         from "formidable";
import nodemailer         from "nodemailer";
import XLSX               from "xlsx";
import { v4 as uuidv4 }   from "uuid";
import { getServerSession } from "next-auth/next";
import { authOptions, USERS } from "./auth/[...nextauth]";

/* ───────── Chemins ───────── */
const DATA_FILE    = path.join(process.cwd(), "data",   "commandes.json");
const STOCK_FILE   = path.join(process.cwd(), "public", "Stock.xlsm");
const HISTORY_FILE = path.join(process.cwd(), "data",   "stockHistory.json");
const UPLOAD_DIR   = path.join(process.cwd(), "public", "uploads");

/* ───────── Helpers JSON ───────── */
async function readCommandes() {
  try { return JSON.parse(await fs.readFile(DATA_FILE, "utf8")); }
  catch { return []; }
}
async function writeCommandes(arr) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(arr, null, 2));
}
async function appendHistory(entry) {
  let hist=[]; try{ hist=JSON.parse(await fs.readFile(HISTORY_FILE,"utf8")); }catch{}
  hist.push(entry);
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive:true });
  await fs.writeFile(HISTORY_FILE, JSON.stringify(hist,null,2));
}

/* ───────── MAJ Stock à la réception ───────── */
async function applyReceptionToStock(lines) {
  const buf = await fs.readFile(STOCK_FILE);
  const wb  = XLSX.read(buf, { type: "buffer" });
  const sh  = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sh], { defval: 0 });

  lines.forEach(l => {
    const idx = rows.findIndex(r => String(r.Ref).trim() === String(l.Ref).trim());
    console.log("Traitement Ref:", l.Ref, "Trouvée:", idx !== -1, "Qté reçue:", l.qty);
    if (idx === -1) return; // Ref non trouvée

    rows[idx]["Qte stock"] = Number(rows[idx]["Qte stock"] || 0) + Number(l.qty);
    rows[idx]["En Commande"] = Math.max(
      0,
      Number(rows[idx]["En Commande"] || 0) - Number(l.qty)
    );
  });

  // Réécrit le fichier Excel
  const newSheet = XLSX.utils.json_to_sheet(rows);
  wb.Sheets[sh] = newSheet;
  XLSX.writeFile(wb, STOCK_FILE);
}

/* ───────── SMTP (avec fallback 587) ───────── */
function buildTransport({ port, secure }) {
  return nodemailer.createTransport({
    host : "smtp.gmail.com",
    port, secure,
    auth : { user:process.env.SMTP_USER, pass:process.env.SMTP_PASSWORD },
    tls  : { rejectUnauthorized:false }     // évite les chain issues en 587
  });
}

let transporter = buildTransport({ port:465, secure:true });

transporter.verify().then(()=>{
  console.log("✅ SMTP 465 OK");
}).catch(async err=>{
  console.error("⚠️  SMTP 465 KO :", err.message);
  console.log("⤹  Tentative sur 587 STARTTLS…");
  transporter = buildTransport({ port:587, secure:false });
  try {
    await transporter.verify();
    console.log("✅ SMTP 587 OK");
  } catch(e){
    console.error("❌ Impossible d’initialiser SMTP :", e.message);
  }
});

export const config = { api:{ bodyParser:false } };   // disable default bodyParser

/* ───────── GET Raw Body helper ───────── */
const getRawBody = req=>new Promise((res,rej)=>{
  let b=""; req.on("data",c=>b+=c); req.on("end",()=>res(b)); req.on("error",rej);
});

/* ───────── Handler principal ───────── */
export default async function handler(req, res) {
  /* Auth */
  const session = await getServerSession(req,res,authOptions);
  if(!session) return res.status(401).json({error:"Non authentifié"});
  const userName=session.user.name, userEmail=session.user.email;

  /* Charge commandes */
  const commandes = await readCommandes();

  /* -------- GET -------------------------------------------------------- */
  if(req.method==="GET") return res.status(200).json(commandes);

  /* -------- POST ------------------------------------------------------- */
  if(req.method==="POST"){
    if(req.headers["content-type"]?.startsWith("multipart/form-data")){
      await fs.mkdir(UPLOAD_DIR,{recursive:true});
      const form=formidable({uploadDir:UPLOAD_DIR,keepExtensions:true});
      form.parse(req,async(err,fields,files)=>{
        if(err) return res.status(500).send(err.message);
        const f = Array.isArray(files.file)?files.file[0]:files.file;
        const url=`/uploads/${f.newFilename}`;
        const cmd={
          id:uuidv4(),
          fournisseur: fields.fournisseur||"N/A",
          filename   : f.originalFilename,
          url,
          lignes     : JSON.parse(fields.lignes||"[]"),
          statut     : "en cours",
          createdAt  : new Date().toISOString(),
          creator    : userName,
          creatorEmail:userEmail,
          messages   :[],
          comment    :null
        };
        commandes.push(cmd); await writeCommandes(commandes);
        return res.status(201).json(cmd);
      });
      return;
    }
    /* JSON simple */
    try{
      const body=JSON.parse(await getRawBody(req));
      const cmd={
        id:uuidv4(),
        fournisseur:body.fournisseur||"N/A",
        filename   :body.pdfName||null,
        url        :body.pdfName?`/uploads/${body.pdfName}`:null,
        lignes     :body.lignes||[],
        statut     :"en cours",
        createdAt  :new Date().toISOString(),
        creator    :userName,
        creatorEmail:userEmail,
        messages   :[],
        comment    :null
      };
      commandes.push(cmd); await writeCommandes(commandes);
      return res.status(201).json(cmd);
    }catch{ return res.status(400).send("JSON invalide");}
  }

  /* -------- PUT -------------------------------------------------------- */
  if(req.method==="PUT"){
    let body = req.body;
    if (!body || typeof body !== "object") {
      try {
        const raw = await getRawBody(req);
        body = JSON.parse(raw);
      } catch {
        return res.status(400).json({ error: "Corps de requête invalide" });
      }
    }
    const { id, reception, statut } = body;
    const idx = commandes.findIndex(c=>c.id===id);
    if(idx===-1) return res.status(404).send("Commande introuvable");

    const commande = commandes[idx];

    // --- Ajoute ce bloc pour gérer le changement de statut ---
    if (statut && typeof statut === "string") {
      commande.statut = statut;
      // Si passage en "terminée"
      if (statut === "terminée") {
        if (commande.lignes && commande.lignes.length > 0) {
          // 1. Calcule la quantité totale commandée pour chaque Ref
          const refsCommandees = {};
          for (const l of commande.lignes) {
            refsCommandees[l.Ref] = (refsCommandees[l.Ref] || 0) + Number(l.qty || 0);
          }
          // 2. Calcule la quantité totale déjà reçue pour chaque Ref
          const refsRecues = {};
          for (const l of commande.receivedLines || []) {
            refsRecues[l.Ref] = (refsRecues[l.Ref] || 0) + Number(l.qty || 0);
          }
          // 3. Prépare les lignes à réceptionner (seulement les manquantes)
          const aRecevoir = Object.keys(refsCommandees).map(ref => ({
            Ref: ref,
            qty: Math.max(0, refsCommandees[ref] - (refsRecues[ref] || 0))
          })).filter(l => l.qty > 0);

          if (aRecevoir.length > 0) {
            await applyReceptionToStock(aRecevoir);
            // Cumule dans receivedLines
            const recues = [...(commande.receivedLines || [])];
            for (const l of aRecevoir) {
              const idx = recues.findIndex(r => r.Ref === l.Ref);
              if (idx === -1) {
                recues.push({ Ref: l.Ref, qty: Number(l.qty) || 0 });
              } else {
                recues[idx].qty = Number(recues[idx].qty || 0) + Number(l.qty || 0);
              }
            }
            commande.receivedLines = recues;
          }
        }
        // Envoie un mail automatique
        try {
          await sendReceptionMail(commande);
        } catch (e) {
          console.error("Erreur envoi mail:", e);
        }
      }
      await writeCommandes(commandes);
      return res.status(200).json({ ok: true });
    }
    // ---------------------------------------------------------

    if (reception && Array.isArray(reception)) {
      // 1. Ne traite que les quantités réellement nouvelles à recevoir
      const recuesAvant = {};
      for (const l of commande.receivedLines || []) {
        recuesAvant[l.Ref] = (recuesAvant[l.Ref] || 0) + Number(l.qty || 0);
      }
      const aRecevoir = [];
      for (const l of reception) {
        const deja = recuesAvant[l.Ref] || 0;
        const aAjouter = Math.max(0, Number(l.qty || 0) - deja);
        if (aAjouter > 0) {
          aRecevoir.push({ Ref: l.Ref, qty: aAjouter });
        }
      }
      // Ajoute uniquement les quantités réellement nouvelles au stock
      if (aRecevoir.length > 0) {
        await applyReceptionToStock(aRecevoir);
      }

      // 2. Cumule les quantités reçues pour chaque Ref
      const recues = [...(commande.receivedLines || [])];
      for (const l of reception) {
        const idx = recues.findIndex(r => r.Ref === l.Ref);
        if (idx === -1) {
          recues.push({ Ref: l.Ref, qty: Number(l.qty) || 0 });
        } else {
          recues[idx].qty = Number(l.qty || 0); // Remplace par la dernière valeur reçue
        }
      }
      commande.receivedLines = recues;

      // 3. Si toutes les lignes sont reçues, passe la commande en "terminée"
      if (commande.lignes && commande.lignes.length > 0) {
        const refsCommandees = {};
        for (const l of commande.lignes) {
          refsCommandees[l.Ref] = (refsCommandees[l.Ref] || 0) + Number(l.qty || 0);
        }
        const refsRecues = {};
        for (const l of commande.receivedLines || []) {
          refsRecues[l.Ref] = (refsRecues[l.Ref] || 0) + Number(l.qty || 0);
        }
        const allReceived = Object.keys(refsCommandees).every(ref =>
          (refsRecues[ref] || 0) >= refsCommandees[ref]
        );
        commande.statut = allReceived ? "terminée" : "partielle";
      }

      await writeCommandes(commandes);
      res.status(200).json({ ok: true });
      return;
    }
    // ...autres traitements...
  }

  /* -------- DELETE ----------------------------------------------------- */
  if(req.method==="DELETE"){
    const { id } = req.query;
    const i = commandes.findIndex(c=>c.id===id);
    if(i===-1) return res.status(404).send("Commande introuvable");
    const [del] = commandes.splice(i,1);
    if(del.url) try{ await fs.unlink(path.join(process.cwd(),"public",del.url)); }catch{}
    await writeCommandes(commandes);
    return res.status(204).end();
  }

  // Si la méthode n'est pas gérée :
  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

/* ───────── Envoi mail réception commande ───────── */
async function sendReceptionMail(commande) {
  const recipient =
    commande.creatorEmail ||
    (USERS.find(u => u.name === commande.creator) || {}).email ||
    process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"Stock App"<${process.env.SMTP_USER}>`,
    to: recipient,
    subject: `✅ BC "${commande.filename || commande.id}" reçu`,
    text:
      `Bonjour ${commande.creator},\n` +
      `Votre bon de commande "${commande.filename || commande.id}" est maintenant marqué "reçu".\n\n` +
      `Cordialement,\nL’équipe Stock App`
  });
}
