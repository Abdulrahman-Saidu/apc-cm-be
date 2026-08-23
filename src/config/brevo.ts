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
}

export const brevoClient = new BrevoClient();