import { Request, Response } from 'express';
import { mobileAuthService } from './service';

export const mobileAuthController = {
  async inviteAgent(req: Request, res: Response) {
    const result = await mobileAuthService.inviteAgent(req.user!.id, req.user!.email, req.body);
    res.status(201).json({ message: 'Invite sent', ...result });
  },

  async registerInvite(req: Request, res: Response) {
    const result = await mobileAuthService.registerInvite(req.body);
    res.status(201).json({ message: 'OTP sent to your email', ...result });
  },

  async resendOtp(req: Request, res: Response) {
    const result = await mobileAuthService.resendOtp(req.body.email);
    res.status(200).json({ message: 'OTP resent', ...result });
  },

  async verifyOtp(req: Request, res: Response) {
    const result = await mobileAuthService.verifyOtp(req.body.email, req.body.code);
    res.status(200).json({ message: 'Account verified', ...result });
  },

  async login(req: Request, res: Response) {
    const result = await mobileAuthService.login(req.body.email, req.body.password);
    res.status(200).json({ message: 'Login successful', ...result });
  },

  async forgotPassword(req: Request, res: Response) {
    const result = await mobileAuthService.forgotPassword(req.body.email);
    res.status(200).json(result);
  },

  async verifyResetOtp(req: Request, res: Response) {
    const result = await mobileAuthService.verifyResetOtp(req.body.email, req.body.code);
    res.status(200).json({ message: 'Code verified', ...result });
  },

  async resetPassword(req: Request, res: Response) {
    const result = await mobileAuthService.resetPassword(req.body.resetToken, req.body.newPassword);
    res.status(200).json(result);
  },
};