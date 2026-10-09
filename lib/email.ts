import nodemailer, { type Transporter } from 'nodemailer';

interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let cached: Transporter | null | undefined;

function transport(): Transporter | null {
  if (cached !== undefined) return cached;
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    cached = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS (Gmail's submission port)
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cached;
}

function from(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'sakubun@localhost';
}

export async function sendEmail({ to, subject, text, html }: Mail): Promise<void> {
  const t = transport();
  if (!t) {
    console.warn(
      `[email] SMTP not configured — email to ${to} NOT sent.\nSubject: ${subject}\n${text}`,
    );
    return;
  }
  await t.sendMail({ from: from(), to, subject, text, html });
}
