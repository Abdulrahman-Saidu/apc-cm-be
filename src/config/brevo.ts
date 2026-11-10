import { env } from './env';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

/**
 * Transactional email through Brevo's HTTP API.
 * (Replaces the old sib-api-v3-sdk package, which Brevo no longer maintains.)
 */

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const SEND_TIMEOUT_MS = 10_000;

export const BRAND = {
  name: 'Baba Isa Vanguard',
  tagline: 'For Uba Sani and Tinubu',
};

const COLORS = {
  navy: '#08417B',
  blue: '#0073A7',
  text: '#1E293B',
  muted: '#64748B',
  border: '#E2E8F0',
  bg: '#F1F5F9',
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Escapes text before it goes into HTML (names and links come from user input). */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstName(name: string | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : 'there';
}

type Email = {
  to: { email: string; name?: string };
  subject: string;
  /** Short line shown next to the subject in most inboxes. */
  preheader: string;
  title: string;
  bodyHtml: string;
  text: string;
};

function renderShell(title: string, preheader: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
</head>
<body style="margin:0; padding:0; background:${COLORS.bg};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${esc(preheader)}</div>
  <div style="background:${COLORS.bg}; padding:32px 16px; font-family:${FONT};">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid ${COLORS.border};">

      <div style="background:${COLORS.navy}; padding:24px 32px;">
        <div style="font-size:16px; font-weight:700; letter-spacing:0.4px; color:#ffffff;">${esc(BRAND.name)}</div>
        <div style="margin-top:4px; font-size:12px; color:rgba(255,255,255,0.75);">${esc(BRAND.tagline)}</div>
      </div>

      <div style="padding:32px; color:${COLORS.text};">
        <h1 style="margin:0 0 16px; font-size:20px; line-height:1.3; font-weight:700; color:${COLORS.navy};">${esc(title)}</h1>
        ${bodyHtml}
      </div>

      <div style="padding:20px 32px; border-top:1px solid ${COLORS.border}; background:${COLORS.bg};">
        <p style="margin:0; font-size:12px; line-height:1.6; color:${COLORS.muted};">
          This is an automated message from ${esc(BRAND.name)}. If you weren't expecting it, you can safely ignore it.
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;
}

function paragraph(html: string, extra = ''): string {
  return `<p style="margin:0 0 16px; font-size:14px; line-height:1.6;${extra}">${html}</p>`;
}

function button(label: string, href: string): string {
  return `<div style="margin:8px 0 24px;">
    <a href="${esc(href)}" style="display:inline-block; background:${COLORS.blue}; color:#ffffff; padding:13px 28px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:600;">${esc(label)}</a>
  </div>`;
}

function linkFallback(href: string): string {
  return `<p style="margin:0 0 6px; font-size:13px; color:${COLORS.muted};">If the button doesn't work, copy and paste this link into your browser:</p>
  <p style="margin:0; font-size:13px; color:${COLORS.blue}; word-break:break-all;">${esc(href)}</p>`;
}

function textFooter(): string {
  return `\n\n--\n${BRAND.name}, ${BRAND.tagline}.\nThis is an automated message. If you weren't expecting it, you can ignore it.`;
}

async function send(email: Email): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const res = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': env.brevo.apiKey,
      },
      body: JSON.stringify({
        sender: { email: env.brevo.senderEmail, name: env.brevo.senderName },
        to: [email.to.name ? { email: email.to.email, name: email.to.name } : { email: email.to.email }],
        subject: email.subject,
        htmlContent: renderShell(email.title, email.preheader, email.bodyHtml),
        textContent: email.text + textFooter(),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Brevo explains failures in the body; log it, never show it to users.
      const detail = await res.text().catch(() => '');
      logger.error('Email send rejected', { status: res.status, subject: email.subject, detail: detail.slice(0, 300) });
      throw new AppError('We could not send the email right now. Please try again in a moment.', 502);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Email send failed', {
      subject: email.subject,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw new AppError('We could not send the email right now. Please try again in a moment.', 502);
  } finally {
    clearTimeout(timeout);
  }
}

class BrevoClient {
  async sendOtpEmail(to: string, name: string, code: string, purpose: 'REGISTER' | 'RESET_PASSWORD') {
    const isRegister = purpose === 'REGISTER';
    const title = isRegister ? 'Verify your email' : 'Reset your password';
    const action = isRegister ? 'finish setting up your account' : 'reset your password';

    const bodyHtml = `
      ${paragraph(`Hi ${esc(firstName(name))},`)}
      ${paragraph(`Use this code to ${action}:`)}
      <div style="margin:0 0 20px; padding:18px; background:${COLORS.bg}; border:1px solid ${COLORS.border}; border-radius:8px; text-align:center;">
        <span style="font-size:30px; font-weight:700; letter-spacing:6px; color:${COLORS.navy};">${esc(code)}</span>
      </div>
      ${paragraph(
        `This code expires in ${env.otpExpiresMinutes} minutes. Never share it with anyone, including people who say they work for ${esc(BRAND.name)}.`,
        ` font-size:13px; color:${COLORS.muted}; margin-bottom:0;`
      )}
    `;

    await send({
      to: { email: to, name },
      // The code stays out of the subject and preview so it never shows on a locked screen.
      subject: isRegister ? `Your ${BRAND.name} verification code` : `Your ${BRAND.name} password reset code`,
      preheader: `Your code to ${action}. It expires in ${env.otpExpiresMinutes} minutes.`,
      title,
      bodyHtml,
      text: `Hi ${firstName(name)},\n\nUse this code to ${action}: ${code}\n\nIt expires in ${env.otpExpiresMinutes} minutes. Never share it with anyone.`,
    });
  }

  async sendInviteEmail(to: string, name: string, inviteLink: string) {
    const bodyHtml = `
      ${paragraph(`Hi ${esc(firstName(name))},`)}
      ${paragraph(`You've been invited to join the ${esc(BRAND.name)} dashboard as an <strong>Admin</strong>.`)}
      ${button('Complete your registration', inviteLink)}
      ${linkFallback(inviteLink)}
    `;

    await send({
      to: { email: to, name },
      subject: `You're invited to the ${BRAND.name} dashboard`,
      preheader: 'Complete your registration to start managing registrations.',
      title: "You've been invited",
      bodyHtml,
      text: `Hi ${firstName(name)},\n\nYou've been invited to join the ${BRAND.name} dashboard as an Admin.\n\nComplete your registration here:\n${inviteLink}`,
    });
  }

  async sendAgentInviteEmail(to: string, name: string, agentCode: string, downloadLink: string) {
    const bodyHtml = `
      ${paragraph(`Hi ${esc(firstName(name))},`)}
      ${paragraph(`You've been invited to join ${esc(BRAND.name)} as a <strong>Field Agent</strong>.`, ' margin-bottom:8px;')}
      ${paragraph(`Your agent code: <strong style="color:${COLORS.navy};">${esc(agentCode)}</strong>`, ' margin-bottom:24px;')}
      ${button('Download the app', downloadLink)}
      ${paragraph(`Once it's installed, tap <strong>Register</strong> and use this exact email address: <strong>${esc(to)}</strong>`)}
      ${linkFallback(downloadLink)}
    `;

    await send({
      to: { email: to, name },
      subject: `Welcome to ${BRAND.name}: download the agent app`,
      preheader: `Your agent code is ${agentCode}. Download the app to get started.`,
      title: "You've been invited as a Field Agent",
      bodyHtml,
      text: `Hi ${firstName(name)},\n\nYou've been invited to join ${BRAND.name} as a Field Agent.\nYour agent code: ${agentCode}\n\nDownload the app:\n${downloadLink}\n\nOnce it's installed, tap Register and use this exact email address: ${to}`,
    });
  }

  async sendApkDownloadInviteEmail(to: string, downloadLink: string, expiresAt: string) {
    const expiryText = new Date(expiresAt).toLocaleString('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Lagos',
    });

    const bodyHtml = `
      ${paragraph('Hi,')}
      ${paragraph(`Use the button below to download the ${esc(BRAND.name)} app. This link is unique to you and works once.`, ' margin-bottom:24px;')}
      ${button('Download the app', downloadLink)}
      ${paragraph(
        `This link expires on ${esc(expiryText)} and stops working after your first download. If it has expired or was already used, ask your administrator for a new one.`,
        ` font-size:13px; color:${COLORS.muted};`
      )}
      ${linkFallback(downloadLink)}
    `;

    await send({
      to: { email: to },
      subject: `Your ${BRAND.name} app download link`,
      preheader: `Your personal download link. It expires on ${expiryText}.`,
      title: 'Download the app',
      bodyHtml,
      text: `Hi,\n\nDownload the ${BRAND.name} app here (works once):\n${downloadLink}\n\nThis link expires on ${expiryText}. If it has expired or was already used, ask your administrator for a new one.`,
    });
  }
}

export const brevoClient = new BrevoClient();
