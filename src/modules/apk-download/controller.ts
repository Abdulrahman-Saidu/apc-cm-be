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

  // Clicked directly from the invite email — validates/consumes the
  // token then 302-redirects the browser straight to the signed R2
  // URL, so the download starts with no intermediate page.
  async download(req: Request, res: Response) {
    const { downloadUrl } = await apkDownloadService.validateAndConsumeToken(req.params.token);
    res.redirect(302, downloadUrl);
  },
};