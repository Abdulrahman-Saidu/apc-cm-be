declare module 'sib-api-v3-sdk' {
  export class ApiClient {
    static instance: {
      authentications: { [key: string]: { apiKey: string } };
    };
  }

  export class SendSmtpEmail {
    sender: { email: string; name: string };
    to: { email: string; name?: string }[];
    subject: string;
    htmlContent: string;
  }

  export class TransactionalEmailsApi {
    sendTransacEmail(email: SendSmtpEmail): Promise<unknown>;
  }

  const _default: {
    ApiClient: typeof ApiClient;
    SendSmtpEmail: typeof SendSmtpEmail;
    TransactionalEmailsApi: typeof TransactionalEmailsApi;
  };
  export default _default;
}