import SibApiV3Sdk from 'sib-api-v3-sdk';
import { env } from './env';

class BrevoClient {
  private api: InstanceType<typeof SibApiV3Sdk.TransactionalEmailsApi>;

  constructor() {
    const client = SibApiV3Sdk.ApiClient.instance;
    client.authentications['api-key'].apiKey = env.brevo.apiKey;
    this.api = new SibApiV3Sdk.TransactionalEmailsApi();
  }

  async sendOtpEmail(to: string, name: string, code: string, purpose: 'REGISTER' | 'RESET_PASSWORD') {
    const heading = purpose === 'REGISTER' ? 'Verify your account' : 'Reset your password';
    const email = new SibApiV3Sdk.SendSmtpEmail();

    email.sender = { email: env.brevo.senderEmail, name: env.brevo.senderName };
    email.to = [{ email: to, name }];
    email.subject = `${heading} — Your OTP code`;
    email.htmlContent = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${heading}</h2>
        <p>Hi ${name},</p>
        <p>Your one-time verification code is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>This code expires in ${env.otpExpiresMinutes} minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `;

    await this.api.sendTransacEmail(email);
  }

  async sendInviteEmail(to: string, name: string, inviteLink: string, inviterName: string) {
    const email = new SibApiV3Sdk.SendSmtpEmail();

    email.sender = { email: env.brevo.senderEmail, name: env.brevo.senderName };
    email.to = [{ email: to, name }];
    email.subject = `You've been invited to the ${env.brevo.senderName} dashboard`;
    email.htmlContent = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You've been invited</h2>
        <p>Hi ${name},</p>
        <p>${inviterName} has invited you to join the dashboard as an admin.</p>
        <p><a href="${inviteLink}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Complete your registration</a></p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break:break-all;color:#64748B;">${inviteLink}</p>
      </div>
    `;

    await this.api.sendTransacEmail(email);
  }

  async sendAgentInviteEmail(to: string, name: string, agentCode: string, playStoreUrl: string, inviterName: string) {
  const email = new SibApiV3Sdk.SendSmtpEmail();

  email.sender = { email: env.brevo.senderEmail, name: env.brevo.senderName };
  email.to = [{ email: to, name }];
  email.subject = `You've been invited as a Field Agent`;
  email.htmlContent = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>You've been invited as a Field Agent</h2>
      <p>Hi ${name},</p>
      <p>${inviterName} has invited you to join as a Field Agent (code: ${agentCode}).</p>
      <p><a href="${playStoreUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Download the app</a></p>
      <p>Once installed, register using this exact email address: <b>${to}</b></p>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break:break-all;color:#64748B;">${playStoreUrl}</p>
    </div>
  `;

  await this.api.sendTransacEmail(email);
}
}

export const brevoClient = new BrevoClient();