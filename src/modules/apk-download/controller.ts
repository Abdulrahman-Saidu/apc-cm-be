import { Request, Response } from 'express';
import { apkDownloadService, isWellFormedToken } from './service';
import { BRAND } from '@/config/brevo';

function page(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title}</title>
</head>
<body style="margin:0;background:#06324B;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <main style="max-width:420px;margin:0 auto;padding:72px 24px;text-align:center;">
    <div style="font-size:22px;font-weight:700;letter-spacing:0.3px;">${BRAND.name}</div>
    <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.7);">${BRAND.tagline}</div>
    ${bodyHtml}
  </main>
</body>
</html>`;
}

export const apkDownloadController = {
  async invite(req: Request, res: Response) {
    const result = await apkDownloadService.inviteAgent(req.user!.id, req.body.email);
    res.status(201).json({ message: 'Download invite sent', ...result });
  },

  async validate(req: Request, res: Response) {
    const result = await apkDownloadService.validateAndConsumeToken(req.params.token);
    res.status(200).json(result);
  },

  // Landing page hit by the email link. Does NOT consume the token, it
  // only renders a button. Consuming here would let Gmail/Outlook link
  // scanners burn the token before the agent ever taps it.
  async landing(req: Request, res: Response) {
    const token = req.params.token;
    res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer');

    if (!isWellFormedToken(token)) {
      return res
        .status(400)
        .type('html')
        .send(
          page(
            `${BRAND.name}: invalid link`,
            `<p style="margin:40px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.85);">This download link isn't valid. Ask your administrator to send you a new one.</p>`
          )
        );
    }

    // Token is checked to be plain hex above, so it is safe to place in the page.
    return res
      .status(200)
      .type('html')
      .send(
        page(
          `Download the ${BRAND.name} agent app`,
          `<p style="margin:40px 0 28px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.85);">Tap the button to download the agent app. The link works once.</p>
    <a href="/api/agents/apk/get/${token}" style="display:inline-block;padding:15px 32px;background:#0091CE;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Download the app</a>
    <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.6);">After downloading, open the file to install. Your phone may ask you to allow installs from this source.</p>`
        )
      );
  },

  // Hit only when the user taps the button on the landing page.
  // Consumes the token, then 302-redirects to the short-lived signed R2 URL.
  async getFile(req: Request, res: Response) {
    const { downloadUrl } = await apkDownloadService.validateAndConsumeToken(req.params.token);
    res.set('Cache-Control', 'no-store').redirect(302, downloadUrl);
  },
};
