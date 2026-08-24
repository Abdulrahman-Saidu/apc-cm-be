import { Request, Response } from 'express';
import { dashboardOpsService } from './service';

export const dashboardOpsController = {
  async overview(_req: Request, res: Response) {
    const data = await dashboardOpsService.getOverview();
    res.status(200).json(data);
  },

  async listAgents(req: Request, res: Response) {
    const { page, pageSize } = req.query as any;
    const result = await dashboardOpsService.listAgents({ page, pageSize });
    res.status(200).json(result);
  },

  async activateAgent(req: Request, res: Response) {
    const result = await dashboardOpsService.activateAgent(req.params.id);
    res.status(200).json({ message: 'Agent activated', ...result });
  },

  async deactivateAgent(req: Request, res: Response) {
    const result = await dashboardOpsService.deactivateAgent(req.params.id);
    res.status(200).json({ message: 'Agent deactivated', ...result });
  },

  async resetAgentDevice(req: Request, res: Response) {
    const result = await dashboardOpsService.resetAgentDevice(req.params.id);
    res.status(200).json({ message: 'Device binding reset', ...result });
  },

  async listQueue(req: Request, res: Response) {
    const { status, page, pageSize } = req.query as any;
    const result = await dashboardOpsService.listQueue(status ?? 'pending', { page, pageSize });
    res.status(200).json(result);
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
    const { homeAddress, state, lga, page, pageSize } = req.query as any;
    const result = await dashboardOpsService.listRegistry({ homeAddress, state, lga }, { page, pageSize });
    res.status(200).json(result);
  },

  async exportRegistry(req: Request, res: Response) {
    const { homeAddress, state, lga } = req.query as any;
    const csv = await dashboardOpsService.exportRegistryCsv({ homeAddress, state, lga });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="registry-export.csv"');
    res.status(200).send(csv);
  },
};