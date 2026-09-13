import { Request, Response } from 'express';
import { apkDownloadService } from './service';

export const apkDownloadController = {
  async invite(req: Request, res: Response) {
    const result = await apkDownloadService.inviteAgent(req.user!.id, req.body.email);
    res.status(201).json({ message: 'Download invite sent', ...result });
  },

  async validate(req: Request, res: Response) {
    const result = await apkDownloadService.validateAndConsumeToken(req.params.token);
    res.status(200).json(result);
  },

  // Landing page hit by the email link. Does NOT consume the token —
  // just renders a tap target. Consuming here would mean Gmail/Outlook
  // link-prescanners silently burn the token before the agent clicks.
  async landing(req: Request, res: Response) {
    const token = req.params.token;
    res.status(200).type('html').send(`<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Download VRM Agent App</title>
</head>
<body style="font-family:sans-serif;text-align:center;padding:60px 20px;">
  <h2>VRM Agent App</h2>
  <p>Tap below to download the app.</p>
  <a href="/api/agents/apk/get/${token}"
     style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;
     text-decoration:none;border-radius:8px;font-weight:600;">
    Download APK
  </a>
</body>
</html>`);
  },

  // Hit only when the user taps the button on the landing page.
  // Consumes the token then 302-redirects to the signed R2 URL.
  async getFile(req: Request, res: Response) {
    const { downloadUrl } = await apkDownloadService.validateAndConsumeToken(req.params.token);
    res.redirect(302, downloadUrl);
  },
};