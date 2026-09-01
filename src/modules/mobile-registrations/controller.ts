import { Request, Response } from 'express';
import { mobileRegistrationsService } from './service';

export const mobileRegistrationsController = {
  async create(req: Request, res: Response) {
    const result = await mobileRegistrationsService.create(req.user!.id, req.body);
    res.status(201).json({ message: 'Registration submitted', ...result });
  },

  async update(req: Request, res: Response) {
    const result = await mobileRegistrationsService.update(req.user!.id, req.params.id, req.body);
    res.status(200).json({ message: 'Registration updated', ...result });
  },

  async sync(req: Request, res: Response) {
    const results = await mobileRegistrationsService.sync(req.user!.id, req.body.registrations);
    res.status(200).json({ message: 'Sync complete', results });
  },

  async listMine(req: Request, res: Response) {
    const status = (req.query.status as any) ?? 'all';
    const data = await mobileRegistrationsService.listMine(req.user!.id, status);
    res.status(200).json({ data });
  },

  async myStats(req: Request, res: Response) {
    const stats = await mobileRegistrationsService.myStats(req.user!.id);
    res.status(200).json(stats);
  },
};