import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Errors } from '../../shared/errors/appError.js';
import { writeAudit } from '../audit/auditService.js';

function assertOpsRoomsRole(role: string) {
  if (role !== 'admin' && role !== 'manager') {
    throw Errors.forbidden('OPS odaları: ops.app_users rolü admin veya manager olmalı');
  }
}

const CreateRoomSchema = z.object({
  roomNumber: z.string().min(1).max(32),
  floor: z.string().max(32).nullable().optional(),
  capacity: z.number().int().min(1).max(20).optional()
});

export const adminOpsRoomsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/admin/ops-rooms', async (req) => {
    const auth = req.auth;
    if (!auth) throw Errors.unauthorized();
    assertOpsRoomsRole(auth.role);

    const { data, error } = await app.supabase
      .schema('ops')
      .from('rooms')
      .select('id, room_number, floor, capacity, is_active, created_at')
      .eq('hotel_id', auth.hotelId)
      .order('room_number', { ascending: true })
      .limit(500);
    if (error) throw Errors.internal('Failed to load ops rooms');
    return { ok: true, data: data ?? [] };
  });

  app.post('/admin/ops-rooms', async (req) => {
    const auth = req.auth;
    if (!auth) throw Errors.unauthorized();
    assertOpsRoomsRole(auth.role);

    const body = CreateRoomSchema.parse(req.body);
    const roomNumber = body.roomNumber.trim();

    const { data: created, error } = await app.supabase
      .schema('ops')
      .from('rooms')
      .insert({
        hotel_id: auth.hotelId,
        room_number: roomNumber,
        floor: body.floor?.trim() ?? null,
        capacity: body.capacity ?? null,
        is_active: true
      })
      .select('id, room_number, floor, capacity, is_active')
      .single();

    if (error) {
      if (error.code === '23505') throw Errors.conflict('Bu oda numarası zaten kayıtlı');
      throw Errors.internal('Failed to create room');
    }

    await writeAudit({
      supabase: app.supabase,
      hotelId: auth.hotelId,
      actorUserId: auth.authUserId,
      action: 'ops.room.create',
      entityType: 'ops_room',
      entityId: created.id,
      metadata: { room_number: created.room_number }
    });

    return { ok: true, data: created };
  });
};
