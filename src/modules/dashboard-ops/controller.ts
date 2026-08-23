import { Request, Response } from 'express';
import { dashboardOpsService } from './service';

export const dashboardOpsController = {
  async overview(_req: Request, res: Response) {
    const data = await dashboardOpsService.getOverview();
    res.status(200).json(data);
  },

  async listAgents(_req: Request, res: Response) {
    const data = await dashboardOpsService.listAgents();
    res.status(200).json({ data });
  },

  async activateAgent(req: Request, res: Response) {
    const result = await dashboardOpsService.activateAgent(req.params.id);
    res.status(200).json({ message: 'Agent activated', ...result });
  },

  async deactivateAgent(req: Request, res: Response) {
    const result = await dashboardOpsService.deactivateAgent(req.params.id);
    res.status(200).json({ message: 'Agent deactivated', ...result });
  },

  async listQueue(req: Request, res: Response) {
    const status = (req.query.status as any) ?? 'pending';
    const data = await dashboardOpsService.listQueue(status);
    res.status(200).json({ data });
  },

  async approve(req: Request, res: Response) {
    const result = await dashboardOpsService.approve(req.params.id, req.user!.id);
    res.status(200).json({ message: 'Registration approved', ...result });
  },

  async reject(req: Request, res: Response) {
    const result = await dashboardOpsService.reject(req.params.id, req.user!.id, req.body.reason);
    res.status(200).json({ message: 'Registration rejected', ...result });
  },

  async listRegistry(req: Request, res: Response) {
    const { homeAddress, state, lga } = req.query as { homeAddress?: string; state?: string; lga?: string };
    const data = await dashboardOpsService.listRegistry({ homeAddress, state, lga });
    res.status(200).json({ data });
  },

  async exportRegistry(req: Request, res: Response) {
    const { homeAddress, state, lga } = req.query as { homeAddress?: string; state?: string; lga?: string };
    const csv = await dashboardOpsService.exportRegistryCsv({ homeAddress, state, lga });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="registry-export.csv"');
    res.status(200).send(csv);
  },
};