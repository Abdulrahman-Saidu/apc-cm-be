import { z } from 'zod';

export const inviteApkDownloadSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
