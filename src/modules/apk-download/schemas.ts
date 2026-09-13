import { z } from 'zod';

export const inviteApkDownloadSchema = z.object({
  email: z.string().email(),
});
