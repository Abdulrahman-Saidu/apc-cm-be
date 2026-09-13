import crypto from 'node:crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { supabase } from '@/config/supabase';
import { r2Client } from '@/config/r2';
import { brevoClient } from '@/config/brevo';
import { env } from '@/config/env';
import { AppError } from '@/middleware/errorHandler';
import { ApkDownloadInviteRow } from '@/types/db';

const TABLE = 'apk_download_invites';
const INVITE_EXPIRY_HOURS = 48;
const SIGNED_URL_EXPIRY_SECONDS = 300;

export const apkDownloadService = {
  // Creates (or revokes-and-recreates) a one-time download token for `email`
  // and returns the landing-page link. Does NOT send any email — callers
  // decide whether/how to notify the recipient.
  async createInviteToken(invitedByAdminId: string, rawEmail: string) {
    const email = rawEmail.toLowerCase();
    const token = crypto.randomBytes(24).toString('hex');
    const invited_at = new Date().toISOString();
    const expires_at = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    const { error: revokeError } = await supabase
      .from(TABLE)
      .update({ status: 'revoked' })
      .eq('email', email)
      .eq('status', 'pending');
    if (revokeError) throw new AppError('Something went wrong. Please try again.', 500);

    const { error: insertError } = await supabase.from(TABLE).insert({
      email,
      token,
      status: 'pending',
      invited_by: invitedByAdminId,
      invited_at,
      expires_at,
    });
    if (insertError) throw new AppError('Something went wrong creating the download link. Please try again.', 500);

    const downloadLink = `${env.apiPublicUrl}/api/agents/apk/download/${token}`;
    return { downloadLink, expires_at };
  },

  // Standalone admin action — creates a token and emails the link on its
  // own. Used by POST /api/agents/apk/invite (e.g. to resend a lost link
  // to an agent who already registered).
  async inviteAgent(inviterId: string, rawEmail: string) {
    const email = rawEmail.toLowerCase();
    const { downloadLink, expires_at } = await this.createInviteToken(inviterId, email);
    await brevoClient.sendApkDownloadInviteEmail(email, downloadLink, expires_at);
    return { email, inviteSent: true };
  },

  async validateAndConsumeToken(token: string) {
    const { data: invite, error: fetchError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('token', token)
      .maybeSingle<ApkDownloadInviteRow>();
    if (fetchError) throw new AppError('Something went wrong. Please try again.', 500);
    if (!invite) throw new AppError('This download link is invalid.', 400);
    if (invite.status === 'used') throw new AppError('This download link has already been used.', 410);
    if (invite.status === 'revoked') throw new AppError('This download link is no longer valid.', 410);
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new AppError('This download link has expired. Please request a new one.', 410);
    }

    let downloadUrl: string;
    try {
      downloadUrl = await getSignedUrl(
        r2Client,
        new GetObjectCommand({
          Bucket: env.r2.bucket,
          Key: env.r2.filePath,
          ResponseContentDisposition: 'attachment; filename="app-release.apk"',
          ResponseContentType: 'application/vnd.android.package-archive',
        }),
        { expiresIn: SIGNED_URL_EXPIRY_SECONDS }
      );
    } catch {
      throw new AppError('Could not generate download link. Please contact support.', 500);
    }

    const { data: consumed, error: updateError } = await supabase
      .from(TABLE)
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('id', invite.id)
      .eq('status', 'pending')
      .select()
      .maybeSingle();
    if (updateError) throw new AppError('Something went wrong. Please try again.', 500);
    if (!consumed) throw new AppError('This download link has already been used.', 410);

    return {
      downloadUrl,
      expiresInSeconds: SIGNED_URL_EXPIRY_SECONDS,
      email: consumed.email,
    };
  },
};