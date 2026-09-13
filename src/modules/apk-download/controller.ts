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
};