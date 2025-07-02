import nodemailer from 'nodemailer';

function buildTransport({ port, secure }) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: false },
  });
}

let transporter = buildTransport({ port: 465, secure: true });

transporter.verify().then(() => {
  console.log('✅ SMTP 465 OK');
}).catch(async (err) => {
  console.error('⚠️  SMTP 465 KO :', err.message);
  console.log('⤹  Tentative sur 587 STARTTLS…');
  transporter = buildTransport({ port: 587, secure: false });
  try {
    await transporter.verify();
    console.log('✅ SMTP 587 OK');
  } catch (e) {
    console.error('❌ Impossible d’initialiser SMTP :', e.message);
  }
});

export default function getTransporter() {
  return transporter;
}
