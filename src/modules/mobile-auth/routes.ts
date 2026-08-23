import { Router } from 'express';

export const mobileAuthRouter = Router();

// Agents are provisioned by an admin from the dashboard, not self-registered.
// Login / device-binding / OTP endpoints go here once we get to the mobile app phase.
mobileAuthRouter.get('/', (_req, res) => {
  res.json({ message: 'Mobile auth routes coming soon' });
});