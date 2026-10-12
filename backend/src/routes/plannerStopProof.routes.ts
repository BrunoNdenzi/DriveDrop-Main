import { Router, Request, Response } from 'express';
import multer from 'multer';
import { randomBytes, randomUUID } from 'crypto';
import { supabaseAdmin } from '@lib/supabase';
import { asyncHandler, createError } from '@utils/error';
import { plannerBillingService } from '../services/plannerBilling.service';
import { publicLastLocation, type StoredLocation } from '../services/plannerLiveRoute';
import {
  MAX_PROOF_PHOTOS,
  detectImageType,
  estimateStopEta,
  mergeProof,
  safePathPart,
  stopsAhead,
  type StopProof,
} from '../services/plannerProof';

const PROOF_BUCKET = 'planner-proof';
const LINK_DAYS = 7;
const SIGNED_URL_SECONDS = 3600;
const UNDEFINED_COLUMN_CODE = '42703';

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: MAX_PROOF_PHOTOS + 1, fields: 6 },
});

interface StopRecord {
  stopId: string;
  order: number;
  name?: string;
  address: string;
  plannedArrival?: string;
  plannedServiceMinutes: number;
  status: 'pending' | 'arrived' | 'completed' | 'skipped';
  arrivedAt?: string;
  completedAt?: string;
  proof?: StopProof;
}

interface ExecutionRow {
  id: string;
  route_id: string;
  user_id: string;
  status: 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
  stop_progress: StopRecord[];
  planned_snapshot: Record<string, unknown>;
}

function ownerId(req: Request): string {
  if (!req.user?.id) throw createError('Authentication required', 401, 'UNAUTHORIZED');
  return req.user.id;
}

async function ownedExecution(executionId: string, owner: string): Promise<ExecutionRow> {
  const { data, error } = await supabaseAdmin
    .from('planner_route_executions')
    .select('id, route_id, user_id, status, stop_progress, planned_snapshot')
    .eq('id', executionId)
    .eq('user_id', owner)
    .maybeSingle();
  if (error) throw createError(error.message, 500, 'EXECUTION_READ_FAILED');
  if (!data) throw createError('Route execution not found', 404, 'NOT_FOUND');
  return data as unknown as ExecutionRow;
}

function plannedStopFor(execution: Pick<ExecutionRow, 'planned_snapshot'>, stopId: string): Record<string, unknown> | undefined {
  const optimized = execution.planned_snapshot['optimizedResult'];
  const stops = optimized && typeof optimized === 'object' ? (optimized as Record<string, unknown>)['stops'] : undefined;
  return Array.isArray(stops) ? (stops as Array<Record<string, unknown>>).find(stop => stop['id'] === stopId) : undefined;
}

async function signedUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabaseAdmin.storage.from(PROOF_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error || !data) return [];
  return data.flatMap((entry: { signedUrl?: string | null }) => (entry.signedUrl ? [entry.signedUrl] : []));
}

async function proofView(proof: StopProof) {
  const [photos, signature] = await Promise.all([signedUrls(proof.photos), proof.signature ? signedUrls([proof.signature]) : Promise.resolve([])]);
  return {
    photos,
    signature: signature[0] ?? null,
    receiverName: proof.receiverName ?? null,
    notes: proof.notes ?? null,
    capturedAt: proof.capturedAt,
  };
}

// ── Signed-in drivers and dispatchers ────────────────────────────────────

export const plannerProofRouter = Router();

plannerProofRouter.post(
  '/executions/:id/stops/:stopId/proof',
  proofUpload.fields([{ name: 'photos', maxCount: MAX_PROOF_PHOTOS }, { name: 'signature', maxCount: 1 }]),
  asyncHandler(async (req: Request, res: Response) => {
    const owner = ownerId(req);
    const execution = await ownedExecution(req.params['id']!, owner);
    if (execution.status === 'cancelled') throw createError('Cancelled routes cannot take proof', 409, 'INVALID_EXECUTION_STATUS');
    const stopId = req.params['stopId']!;
    const stop = execution.stop_progress.find(item => item.stopId === stopId);
    if (!stop) throw createError('Execution stop not found', 404, 'NOT_FOUND');

    const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const photoFiles = files['photos'] ?? [];
    const signatureFile = files['signature']?.[0];
    const hasText = typeof req.body.notes === 'string' && req.body.notes.trim() || typeof req.body.receiverName === 'string' && req.body.receiverName.trim();
    if (photoFiles.length === 0 && !signatureFile && !hasText) throw createError('Add a photo, a signature, or a note', 400, 'INVALID_INPUT');

    const folder = `${owner}/${execution.id}/${safePathPart(stopId)}`;
    const store = async (file: Express.Multer.File): Promise<string> => {
      const type = detectImageType(file.buffer);
      if (!type) throw createError('Proof must be a JPEG, PNG, or WebP image', 400, 'INVALID_INPUT');
      const path = `${folder}/${randomUUID()}.${type.extension}`;
      const { error } = await supabaseAdmin.storage.from(PROOF_BUCKET).upload(path, file.buffer, { contentType: type.contentType, upsert: false });
      if (error) throw createError('Proof storage is not available yet. Try again shortly.', 503, 'PROOF_STORAGE_UNAVAILABLE');
      return path;
    };
    const photos = await Promise.all(photoFiles.map(store));
    const signature = signatureFile ? await store(signatureFile) : undefined;

    const proof = mergeProof(stop.proof, { photos, signature }, { receiverName: req.body.receiverName, notes: req.body.notes });
    const stopProgress = execution.stop_progress.map(item => (item.stopId === stopId ? { ...item, proof } : item));
    const { error } = await supabaseAdmin
      .from('planner_route_executions')
      .update({ stop_progress: stopProgress })
      .eq('id', execution.id)
      .eq('user_id', owner);
    if (error) throw createError(error.message, 500, 'PROOF_SAVE_FAILED');
    res.status(201).json({ success: true, data: { photos: proof.photos.length, hasSignature: Boolean(proof.signature) } });
  }),
);

plannerProofRouter.get('/executions/:id/proof', asyncHandler(async (req: Request, res: Response) => {
  const execution = await ownedExecution(req.params['id']!, ownerId(req));
  const entries = await Promise.all(
    execution.stop_progress.filter(stop => stop.proof).map(async stop => [stop.stopId, await proofView(stop.proof!)] as const),
  );
  res.json({ success: true, data: Object.fromEntries(entries) });
}));

plannerProofRouter.post('/executions/:id/stops/:stopId/link', asyncHandler(async (req: Request, res: Response) => {
  const owner = ownerId(req);
  await plannerBillingService.assertSharingAllowed(owner);
  const execution = await ownedExecution(req.params['id']!, owner);
  if (execution.status === 'cancelled') throw createError('Cancelled routes cannot be shared', 409, 'INVALID_EXECUTION_STATUS');
  const stopId = req.params['stopId']!;
  if (!execution.stop_progress.some(item => item.stopId === stopId)) throw createError('Execution stop not found', 404, 'NOT_FOUND');

  const now = new Date();
  const { data: existing, error: readError } = await supabaseAdmin
    .from('planner_stop_links')
    .select('token, expires_at')
    .eq('execution_id', execution.id)
    .eq('stop_id', stopId)
    .is('revoked_at', null)
    .gt('expires_at', now.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) throw createError(readError.message, 500, 'STOP_LINK_READ_FAILED');
  if (existing) {
    res.json({ success: true, data: { token: existing.token, expiresAt: existing.expires_at } });
    return;
  }

  const expiresAt = new Date(now.getTime() + LINK_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('planner_stop_links')
    .insert({
      token: randomBytes(24).toString('base64url'),
      user_id: owner,
      route_id: execution.route_id,
      execution_id: execution.id,
      stop_id: stopId,
      expires_at: expiresAt,
    })
    .select('token, expires_at')
    .single();
  if (error) throw createError(error.message, 500, 'STOP_LINK_CREATE_FAILED');
  res.status(201).json({ success: true, data: { token: data.token, expiresAt: data.expires_at } });
}));

plannerProofRouter.delete('/executions/:id/stops/:stopId/link', asyncHandler(async (req: Request, res: Response) => {
  const owner = ownerId(req);
  const execution = await ownedExecution(req.params['id']!, owner);
  const { error } = await supabaseAdmin
    .from('planner_stop_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('execution_id', execution.id)
    .eq('stop_id', req.params['stopId'])
    .eq('user_id', owner)
    .is('revoked_at', null);
  if (error) throw createError(error.message, 500, 'STOP_LINK_REVOKE_FAILED');
  res.status(204).send();
}));

// ── Anyone with the link (a customer): one stop only, nothing else about the route ──

export const plannerTrackingRouter = Router();

plannerTrackingRouter.get('/:token', asyncHandler(async (req: Request, res: Response) => {
  const token = req.params['token'] ?? '';
  const unavailable = () => createError('This tracking link is no longer available', 404, 'TRACKING_LINK_NOT_FOUND');
  if (!/^[\w-]{20,64}$/.test(token)) throw unavailable();

  const { data: link, error: linkError } = await supabaseAdmin
    .from('planner_stop_links')
    .select('execution_id, stop_id, user_id, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle();
  if (linkError) throw createError(linkError.message, 500, 'STOP_LINK_READ_FAILED');
  if (!link || link.revoked_at || new Date(link.expires_at) <= new Date()) throw unavailable();

  const columns = 'status, stop_progress, planned_snapshot, last_latitude, last_longitude, last_heading, last_speed_mps, last_accuracy_meters, last_location_at, last_location_simulated';
  let { data: execution, error } = await supabaseAdmin.from('planner_route_executions').select(columns).eq('id', link.execution_id).maybeSingle();
  // Live location columns come from a later migration; the page still works without them.
  if (error?.code === UNDEFINED_COLUMN_CODE) ({ data: execution, error } = await supabaseAdmin.from('planner_route_executions').select('status, stop_progress, planned_snapshot').eq('id', link.execution_id).maybeSingle());
  if (error) throw createError(error.message, 500, 'EXECUTION_READ_FAILED');
  if (!execution) throw unavailable();

  const row = execution as unknown as ExecutionRow & StoredLocation;
  const stop = row.stop_progress.find(item => item.stopId === link.stop_id);
  if (!stop) throw unavailable();

  const { data: profile } = await supabaseAdmin.from('planner_profiles').select('business_name').eq('user_id', link.user_id).maybeSingle();
  const planned = plannedStopFor(row, stop.stopId);
  const eta = estimateStopEta(stop, row.stop_progress);
  const finished = stop.status === 'completed' || stop.status === 'skipped';
  const live = !finished && row.status !== 'cancelled' && row.status !== 'completed' ? publicLastLocation(row) : null;

  res.json({
    success: true,
    data: {
      business: profile?.business_name ?? null,
      customerName: typeof planned?.['customerName'] === 'string' ? planned['customerName'] : null,
      routeStatus: row.status,
      stop: {
        label: stop.name ?? 'Your stop',
        address: stop.address,
        status: row.status === 'cancelled' && !finished ? 'cancelled' : stop.status,
        estimatedArrival: eta.estimatedArrival,
        delayMinutes: eta.delayMinutes,
        stopsAway: finished ? 0 : stopsAhead(stop, row.stop_progress),
        arrivedAt: stop.arrivedAt ?? null,
        completedAt: stop.completedAt ?? null,
        latitude: typeof planned?.['latitude'] === 'number' ? planned['latitude'] : null,
        longitude: typeof planned?.['longitude'] === 'number' ? planned['longitude'] : null,
      },
      driver: live && !live.simulated ? { latitude: live.latitude, longitude: live.longitude, heading: live.heading, recordedAt: live.recordedAt } : null,
      proof: stop.status === 'completed' && stop.proof ? await proofView(stop.proof) : null,
    },
  });
}));
