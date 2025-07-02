import { USERS } from "../../../data/users.sample";
import getTransporter from "../../../lib/smtp";
import { createResetToken } from "../../../lib/loginSecurity";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email required" });

  const user = USERS.find(u => u.email === email || u.username === email);
  if (!user) return res.status(200).json({ ok: true });

  const token = createResetToken(user.id);
  const transporter = getTransporter();
  
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
  const resetUrl = `${baseUrl}/reset?token=${token}`;

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset?token=${token}`;

  try {
    await transporter.sendMail({
      from: `"Stock App"<${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "Réinitialisation de mot de passe",
      text: `Bonjour ${user.name},\n\nCliquez sur le lien suivant pour réinitialiser votre mot de passe : ${resetUrl}\nCe lien expire dans 1 heure.`,
    });
  } catch (e) {
    console.error("Send reset mail failed:", e.message);
  }

  res.status(200).json({ ok: true });
}

export const config = { api: { bodyParser: true } };
