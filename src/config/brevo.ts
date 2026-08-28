import SibApiV3Sdk from 'sib-api-v3-sdk';
import { env } from './env';

const COLORS = {
  navy: '#08417B',
  blue: '#0073A7',
  blueHover: '#02608A',
  text: '#1E293B',
  muted: '#64748B',
  border: '#E2E8F0',
  bg: '#F1F5F9',
};

const BRAND_NAME = 'APC Consolidation Movement';

class BrevoClient {
  private api: InstanceType<typeof SibApiV3Sdk.TransactionalEmailsApi>;

  constructor() {
    const client = SibApiV3Sdk.ApiClient.instance;
    client.authentications['api-key'].apiKey = env.brevo.apiKey;
    this.api = new SibApiV3Sdk.TransactionalEmailsApi();
  }

  /**
   * Shared branded shell every outgoing email is rendered inside.
   * Keeps the header/footer consistent and avoids duplicating markup per email type.
   */
  private renderShell(title: string, bodyHtml: string) {
    return `
      <div style="background:${COLORS.bg}; padding:32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid ${COLORS.border};">
          
          <!-- Header -->
          <div style="background:${COLORS.navy}; padding:28px 32px;">
            <span style="font-size:15px; font-weight:700; letter-spacing:0.5px; color:#ffffff; text-transform:uppercase;">
              ${BRAND_NAME}
            </span>
          </div>

          <!-- Body -->
          <div style="padding:32px; color:${COLORS.text};">
            <h2 style="margin:0 0 16px; font-size:20px; font-weight:700; color:${COLORS.navy};">
              ${title}
            </h2>
            ${bodyHtml}
          </div>

          <!-- Footer -->
          <div style="padding:20px 32px; border-top:1px solid ${COLORS.border}; background:${COLORS.bg};">
            <p style="margin:0; font-size:12px; color:${COLORS.muted};">
              This is an automated message from the ${BRAND_NAME} platform. If you weren't expecting this email, you can safely ignore it.
            </p>
          </div>

        </div>
      </div>
    `;
  }

  private button(label: string, href: string) {
    return `
      <a href="${href}" style="display:inline-block; background:${COLORS.blue}; color:#ffffff; padding:13px 28px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:600;">
        ${label}
      </a>
    `;
  }

  async sendOtpEmail(to: string, name: string, code: string, purpose: 'REGISTER' | 'RESET_PASSWORD') {
    const heading = purpose === 'REGISTER' ? 'Verify your account' : 'Reset your password';

    const body = `
      <p style="margin:0 0 12px; font-size:14px; line-height:1.6;">Hi ${name},</p>
      <p style="margin:0 0 20px; font-size:14px; line-height:1.6;">Your one-time verification code is below. Enter it to continue.</p>
      <div style="margin:0 0 20px; padding:18px; background:${COLORS.bg}; border:1px solid ${COLORS.border}; border-radius:8px; text-align:center;">
        <span style="font-size:30px; font-weight:700; letter-spacing:6px; color:${COLORS.navy};">${code}</span>
      </div>
      <p style="margin:0; font-size:13px; line-height:1.6; color:${COLORS.muted};">
        This code expires in ${env.otpExpiresMinutes} minutes. If you didn't request this, you can ignore this email.
      </p>
    `;

    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = { email: env.brevo.senderEmail, name: env.brevo.senderName };
    email.to = [{ email: to, name }];
    email.subject = `${heading} — Your OTP code`;
    email.htmlContent = this.renderShell(heading, body);

    await this.api.sendTransacEmail(email);
  }

  async sendInviteEmail(to: string, name: string, inviteLink: string) {
    const body = `
      <p style="margin:0 0 12px; font-size:14px; line-height:1.6;">Hi ${name},</p>
      <p style="margin:0 0 24px; font-size:14px; line-height:1.6;">
        You've been invited to join the ${BRAND_NAME} dashboard as an <strong>Admin</strong>.
      </p>
      <div style="margin:0 0 20px;">
        ${this.button('Complete your registration', inviteLink)}
      </div>
      <p style="margin:0 0 6px; font-size:13px; color:${COLORS.muted};">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin:0; font-size:13px; color:${COLORS.blue}; word-break:break-all;">${inviteLink}</p>
    `;

    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = { email: env.brevo.senderEmail, name: env.brevo.senderName };
    email.to = [{ email: to, name }];
    email.subject = `You've been invited to the ${BRAND_NAME} dashboard`;
    email.htmlContent = this.renderShell("You've been invited", body);

    await this.api.sendTransacEmail(email);
  }

  async sendAgentInviteEmail(to: string, name: string, agentCode: string, playStoreUrl: string) {
    const body = `
      <p style="margin:0 0 12px; font-size:14px; line-height:1.6;">Hi ${name},</p>
      <p style="margin:0 0 8px; font-size:14px; line-height:1.6;">
        You've been invited to join the ${BRAND_NAME} as a <strong>Field Agent</strong>.
      </p>
      <p style="margin:0 0 24px; font-size:14px; line-height:1.6;">
        Your agent code: <strong style="color:${COLORS.navy};">${agentCode}</strong>
      </p>
      <div style="margin:0 0 20px;">
        ${this.button('Download the app', playStoreUrl)}
      </div>
      <p style="margin:0 0 20px; font-size:14px; line-height:1.6;">
        Once installed, register using this exact email address: <strong>${to}</strong>
      </p>
      <p style="margin:0 0 6px; font-size:13px; color:${COLORS.muted};">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin:0; font-size:13px; color:${COLORS.blue}; word-break:break-all;">${playStoreUrl}</p>
    `;

    const email = new SibApiV3Sdk.SendSmtpEmail();
    email.sender = { email: env.brevo.senderEmail, name: env.brevo.senderName };
    email.to = [{ email: to, name }];
    email.subject = `You've been invited as a Field Agent`;
    email.htmlContent = this.renderShell("You've been invited as a Field Agent", body);

    await this.api.sendTransacEmail(email);
  }
}

export const brevoClient = new BrevoClient();