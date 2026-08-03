// Outbound email for the deployed multi-user sakubun. Today its only caller is better-auth, sending
// the sign-up verification link (lib/auth.ts); reminder delivery may reuse it later. SMTP is the
// transport (a Gmail app-password, or any provider) and EVERY value comes from env — nothing is
// hardcoded, because in a multi-user app each message goes to a different user's own address.
//
// When SMTP_* is not configured (local dev, or a deploy that forgot the secret) we do NOT throw: we
// log the message — verification link included — to the server console. So local sign-up still works
// by copying the link out of the log, and a misconfigured production fails loud-but-recoverable in the
// container logs instead of 500-ing every sign-up. Verification only actually protects an account once
// real SMTP credentials are present.

import nodemailer, { type Transporter } from 'nodemailer';

interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// `undefined` = not yet resolved; `null` = resolved-and-unconfigured (don't rebuild every send).
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

/** The From header — an explicit address if set, else the authenticated SMTP user (Gmail sends as it). */
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
