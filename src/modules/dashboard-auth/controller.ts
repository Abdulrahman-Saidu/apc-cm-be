import { Request, Response } from 'express';
import { dashboardAuthService } from './service';

export const dashboardAuthController = {
  async register(req: Request, res: Response) {
    const result = await dashboardAuthService.register(req.body);
    res.status(201).json({ message: 'OTP sent to your email', ...result });
  },

  async resendOtp(req: Request, res: Response) {
    const result = await dashboardAuthService.resendOtp(req.body.email);
    res.status(200).json({ message: 'OTP resent', ...result });
  },

  async verifyOtp(req: Request, res: Response) {
    const result = await dashboardAuthService.verifyOtp(req.body.email, req.body.code);
    res.status(200).json({ message: 'Account verified', ...result });
  },

  async login(req: Request, res: Response) {
    const result = await dashboardAuthService.login(req.body.email, req.body.password);
    res.status(200).json({ message: 'Login successful', ...result });
  },

  async forgotPassword(req: Request, res: Response) {
    const result = await dashboardAuthService.forgotPassword(req.body.email);
    res.status(200).json(result);
  },

  async resetPassword(req: Request, res: Response) {
    const result = await dashboardAuthService.resetPassword(
      req.body.email,
      req.body.code,
      req.body.newPassword
    );
    res.status(200).json(result);
  },
};