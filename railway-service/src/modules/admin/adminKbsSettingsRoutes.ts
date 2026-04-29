import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Errors } from '../../shared/errors/appError.js';
import { writeAudit } from '../audit/auditService.js';
import { encrypt } from '../../shared/security/crypto.js';
import { GatewayClient } from '../../integrations/gateway-client/gatewayClient.js';

/** KBS otel kimlik ayarları: admin + manager (personel `staff` tablosu değil, `ops.app_users.role` geçerlidir). */
function assertKbsSettingsRole(role: string) {
  if (role !== 'admin' && role !== 'manager') {
    throw Errors.forbidden('KBS ayarları: yalnızca ops.app_users rolü admin veya manager olmalı');
  }
}

const UpsertSchema = z.object({
  facilityCode: z.string().min(1),
  username: z.string().min(1),
  /**
   * Password is write-only:
   * - if provided => overwrite
   * - if null/undefined => keep existing encrypted value
   */
  password: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  providerType: z.string().default('default'),
  isActive: z.boolean().default(true)
});

export const adminKbsSettingsRoutes: FastifyPluginAsync = async (app) => {
  const gw = new GatewayClient({ baseUrl: app.env.GATEWAY_BASE_URL, sharedSecret: app.env.GATEWAY_SHARED_SECRET });

  app.get('/admin/kbs-settings', async (req) => {
    const auth = req.auth;
    if (!auth) throw Errors.unauthorized();
    assertKbsSettingsRole(auth.role);

    const { data, error } = await app.supabase
      .schema('ops')
      .from('hotel_kbs_credentials')
      .select('hotel_id, facility_code, username, provider_type, is_active, last_updated_by, last_tested_at, updated_at, created_at')
      .eq('hotel_id', auth.hotelId)
      .maybeSingle();
    if (error) throw Errors.internal('Failed to load settings');

    return { ok: true, data: data ?? null };
  });

  app.post('/admin/kbs-settings', async (req) => {
    const auth = req.auth;
    if (!auth) throw Errors.unauthorized();
    assertKbsSettingsRole(auth.role);

    const body = UpsertSchema.parse(req.body);

    const { data: existing } = await app.supabase
      .schema('ops')
      .from('hotel_kbs_credentials')
      .select('password_encrypted, api_key_encrypted')
      .eq('hotel_id', auth.hotelId)
      .maybeSingle();

    const passwordEncrypted =
      body.password != null ? encrypt(body.password, app.env.KBS_CREDENTIAL_SECRET) : existing?.password_encrypted;
    if (!passwordEncrypted) throw Errors.badRequest('Password required for first-time setup');

    const apiKeyEncrypted =
      body.apiKey != null ? encrypt(body.apiKey, app.env.KBS_CREDENTIAL_SECRET) : existing?.api_key_encrypted ?? null;

    const { error } = await app.supabase.schema('ops').from('hotel_kbs_credentials').upsert(
      {
        hotel_id: auth.hotelId,
        facility_code: body.facilityCode,
        username: body.username,
        password_encrypted: passwordEncrypted,
        api_key_encrypted: apiKeyEncrypted,
        provider_type: body.providerType,
        is_active: body.isActive,
        last_updated_by: auth.authUserId
      },
      { onConflict: 'hotel_id' }
    );
    if (error) throw Errors.internal('Failed to save settings');

    await writeAudit({
      supabase: app.supabase,
      hotelId: auth.hotelId,
      actorUserId: auth.authUserId,
      action: 'kbs.settings.update',
      entityType: 'hotel_kbs_credentials',
      entityId: auth.hotelId,
      metadata: {
        changed_fields: {
          facility_code: true,
          username: true,
          password: body.password != null ? true : false,
          api_key: body.apiKey != null ? true : false,
          provider_type: true,
          is_active: true
        }
      }
    });

    return { ok: true, data: { saved: true } };
  });

  app.post('/admin/kbs-settings/test-connection', async (req) => {
    const auth = req.auth;
    if (!auth) throw Errors.unauthorized();
    assertKbsSettingsRole(auth.role);

    const gwRes = await gw.post<{ ok: boolean; message: string; details?: unknown }>('/gateway/test-connection', {
      hotelId: auth.hotelId
    });

    await app.supabase
      .schema('ops')
      .from('hotel_kbs_credentials')
      .update({ last_tested_at: new Date().toISOString() })
      .eq('hotel_id', auth.hotelId);

    await writeAudit({
      supabase: app.supabase,
      hotelId: auth.hotelId,
      actorUserId: auth.authUserId,
      action: 'kbs.connection.test',
      entityType: 'hotel_kbs_credentials',
      entityId: auth.hotelId,
      metadata: { ok: gwRes.ok ? true : false }
    });

    return gwRes.ok ? { ok: true, data: gwRes.data } : gwRes;
  });
};

