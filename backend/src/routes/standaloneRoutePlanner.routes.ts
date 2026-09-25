import { Router, Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import multer from 'multer';
import { authenticate } from '@middlewares/auth.middleware';
import { supabaseAdmin } from '@lib/supabase';
import { asyncHandler, createError } from '@utils/error';
import { routeOptimizationService, RouteStop } from '../services/RouteOptimizationService';
import { plannerBillingService } from '../services/plannerBilling.service';
import { pricingLiveEvidenceService } from '../services/pricingLiveEvidence.service';

const router = Router();
const MAX_STOPS = 100;
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = file.originalname.toLowerCase().split('.').pop();
    if (extension === 'csv' || extension === 'xlsx') {
      callback(null, true);
      return;
    }
    callback(new Error('Only .csv and .xlsx files are supported'));
  },
});

interface PlannerStopInput {
  id?: string;
  name?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  type?: RouteStop['type'];
  referenceId?: string;
  serviceMinutes?: number;
  priority?: RouteStop['priority'];
  timeWindow?: RouteStop['timeWindow'];
}

interface RecurrenceInput {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval?: number;
  weekdays?: number[];
  startsAt: string;
  endsAt?: string;
}

const ROUTE_COLUMNS = 'id, user_id, name, stops, options, recurrence, next_run_at, is_recurring, last_optimized_result, last_optimized_at, status, current_version, dispatched_at, completed_at, created_at, updated_at';
const LOCATION_COLUMNS = 'id, user_id, name, address, latitude, longitude, notes, created_at, updated_at';

interface PlannerRouteRecord {
  id: string;
  user_id: string;
  name: string;
  stops: PlannerStopInput[];
  options: Record<string, unknown>;
  recurrence: RecurrenceInput | null;
  last_optimized_result: Record<string, unknown> | null;
  status: string;
  current_version: number;
}

interface ExecutionStopProgress {
  stopId: string;
  order: number;
  name?: string;
  address: string;
  plannedArrival?: string;
  plannedServiceMinutes: number;
  status: 'pending' | 'arrived' | 'completed' | 'skipped';
  arrivedAt?: string;
  completedAt?: string;
  skippedAt?: string;
  actualLatitude?: number;
  actualLongitude?: number;
  gpsAccuracyMeters?: number;
  proofOfDeliveryUrls?: string[];
  notes?: string;
}

interface PlannerExecutionRecord {
  id: string;
  route_id: string;
  user_id: string;
  version_number: number;
  status: 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
  planned_start_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  planned_snapshot: Record<string, unknown>;
  stop_progress: ExecutionStopProgress[];
  reoptimizations: Record<string, unknown>[];
  actual_distance_miles: number | null;
}

function userId(req: Request): string {
  if (!req.user?.id) throw createError('Authentication required', 401, 'UNAUTHORIZED');
  return req.user.id;
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw createError(`${field} is required`, 400, 'INVALID_INPUT');
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw createError(`${field} must be ${maxLength} characters or fewer`, 400, 'INVALID_INPUT');
  }
  return normalized;
}

function optionalIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw createError(`${field} must be a valid date`, 400, 'INVALID_INPUT');
  return date.toISOString();
}

function csvCell(value: unknown): string {
  const normalized = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

async function ownedRoute(routeId: string, ownerId: string): Promise<PlannerRouteRecord> {
  const { data, error } = await supabaseAdmin
    .from('planner_routes')
    .select(ROUTE_COLUMNS)
    .eq('id', routeId)
    .eq('user_id', ownerId)
    .maybeSingle();
  if (error) throw createError(error.message, 500, 'ROUTE_READ_FAILED');
  if (!data) throw createError('Route not found', 404, 'NOT_FOUND');
  return data as PlannerRouteRecord;
}

function routeSnapshot(route: PlannerRouteRecord): Record<string, unknown> {
  return {
    name: route.name,
    stops: route.stops,
    options: route.options,
    recurrence: route.recurrence,
    optimizedResult: route.last_optimized_result,
  };
}

async function recordRouteVersion(route: PlannerRouteRecord, changeType: string): Promise<void> {
  const { error } = await supabaseAdmin.from('planner_route_versions').insert({
    route_id: route.id,
    user_id: route.user_id,
    version_number: route.current_version,
    change_type: changeType,
    snapshot: routeSnapshot(route),
  });
  if (error) throw createError(error.message, 500, 'ROUTE_VERSION_SAVE_FAILED');
}

async function ownedExecution(executionId: string, ownerId: string): Promise<PlannerExecutionRecord> {
  const { data, error } = await supabaseAdmin
    .from('planner_route_executions')
    .select('*')
    .eq('id', executionId)
    .eq('user_id', ownerId)
    .maybeSingle();
  if (error) throw createError(error.message, 500, 'EXECUTION_READ_FAILED');
  if (!data) throw createError('Route execution not found', 404, 'NOT_FOUND');
  return data as PlannerExecutionRecord;
}

function plannedStops(route: PlannerRouteRecord): ExecutionStopProgress[] {
  const optimizedStops = route.last_optimized_result?.['stops'];
  const source = Array.isArray(optimizedStops) ? optimizedStops : route.stops;
  return source.map((value, index) => {
    const stop = value as Record<string, unknown>;
    return {
      stopId: String(stop['id'] ?? `stop-${index + 1}`),
      order: Number(stop['order'] ?? index + 1),
      ...(stop['vehicleInfo'] || stop['name'] ? { name: String(stop['vehicleInfo'] ?? stop['name']) } : {}),
      address: String(stop['address'] ?? ''),
      ...(stop['estimatedArrival'] ? { plannedArrival: String(stop['estimatedArrival']) } : {}),
      plannedServiceMinutes: Number(stop['estimatedDuration'] ?? stop['serviceMinutes'] ?? 0),
      status: 'pending',
    };
  });
}

async function optimizeWithLiveEvidence(stops: RouteStop[], options: Record<string, unknown>) {
  const result = await routeOptimizationService.optimizeRoute(stops, options);
  const liveEvidence = await pricingLiveEvidenceService.collectRoute(result.stops.map(stop => stop.address));
  return { ...result, liveEvidence };
}

function optionalCoordinate(value: unknown, min: number, max: number, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) {
    throw createError(`${field} is invalid`, 400, 'INVALID_INPUT');
  }
  return coordinate;
}

export function normalizeStops(value: unknown): RouteStop[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_STOPS) {
    throw createError(`Routes require between 2 and ${MAX_STOPS} stops`, 400, 'INVALID_STOPS');
  }

  const allowedTypes = new Set<RouteStop['type']>([
    'current_location', 'stop', 'pickup', 'delivery', 'fuel', 'rest',
  ]);

  return value.map((raw, index) => {
    const input = raw as PlannerStopInput;
    const type = input.type ?? (index === 0 ? 'current_location' : 'stop');
    if (!allowedTypes.has(type)) {
      throw createError(`Stop ${index + 1} has an invalid type`, 400, 'INVALID_STOPS');
    }
    const serviceMinutes = input.serviceMinutes === undefined ? 10 : Number(input.serviceMinutes);
    if (!Number.isFinite(serviceMinutes) || serviceMinutes < 0 || serviceMinutes > 1440) {
      throw createError(`Stop ${index + 1} has invalid service minutes`, 400, 'INVALID_STOPS');
    }

    return {
      id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : `stop-${index + 1}`,
      address: text(input.address, `Stop ${index + 1} address`, 500),
      type: index === 0 ? 'current_location' : type,
      latitude: optionalCoordinate(input.latitude, -90, 90, `Stop ${index + 1} latitude`),
      longitude: optionalCoordinate(input.longitude, -180, 180, `Stop ${index + 1} longitude`),
      shipmentId: typeof input.referenceId === 'string' ? input.referenceId.trim() || undefined : undefined,
      vehicleInfo: typeof input.name === 'string' ? input.name.trim().slice(0, 160) || undefined : undefined,
      estimatedDuration: serviceMinutes,
      priority: input.priority,
      timeWindow: input.timeWindow,
    };
  });
}

function normalizeStoredStops(value: unknown): PlannerStopInput[] {
  return normalizeStops(value).map(stop => ({
    id: stop.id,
    address: stop.address,
    type: stop.type,
    serviceMinutes: stop.estimatedDuration ?? 10,
    ...(stop.vehicleInfo ? { name: stop.vehicleInfo } : {}),
    ...(stop.latitude !== undefined ? { latitude: stop.latitude } : {}),
    ...(stop.longitude !== undefined ? { longitude: stop.longitude } : {}),
    ...(stop.shipmentId ? { referenceId: stop.shipmentId } : {}),
    ...(stop.priority ? { priority: stop.priority } : {}),
    ...(stop.timeWindow ? { timeWindow: stop.timeWindow } : {}),
  }));
}

export function normalizeRecurrence(value: unknown): { recurrence: RecurrenceInput | null; nextRunAt: string | null } {
  if (value === undefined || value === null) return { recurrence: null, nextRunAt: null };
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw createError('Recurrence must be an object', 400, 'INVALID_RECURRENCE');
  }

  const input = value as RecurrenceInput;
  if (!['daily', 'weekly', 'monthly'].includes(input.frequency)) {
    throw createError('Recurrence frequency must be daily, weekly, or monthly', 400, 'INVALID_RECURRENCE');
  }
  const interval = Number(input.interval ?? 1);
  const startsAt = new Date(input.startsAt);
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (!Number.isInteger(interval) || interval < 1 || interval > 365 || Number.isNaN(startsAt.getTime())) {
    throw createError('Recurrence interval or start date is invalid', 400, 'INVALID_RECURRENCE');
  }
  if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt)) {
    throw createError('Recurrence end date must be after its start date', 400, 'INVALID_RECURRENCE');
  }

  const weekdays = input.frequency === 'weekly'
    ? [...new Set(input.weekdays ?? [startsAt.getUTCDay()])]
    : undefined;
  if (weekdays?.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw createError('Weekdays must contain values from 0 through 6', 400, 'INVALID_RECURRENCE');
  }

  const recurrence: RecurrenceInput = {
    frequency: input.frequency,
    interval,
    startsAt: startsAt.toISOString(),
    ...(weekdays ? { weekdays } : {}),
    ...(endsAt ? { endsAt: endsAt.toISOString() } : {}),
  };

  let next = new Date(startsAt);
  const now = new Date();
  if (input.frequency === 'daily') {
    while (next < now) next.setUTCDate(next.getUTCDate() + interval);
  } else if (input.frequency === 'monthly') {
    while (next < now) next.setUTCMonth(next.getUTCMonth() + interval);
  } else {
    while (true) {
      const daysSinceStart = Math.max(0, Math.floor((next.getTime() - startsAt.getTime()) / 86_400_000));
      const activeWeek = Math.floor(daysSinceStart / 7) % interval === 0;
      if (next >= now && activeWeek && weekdays!.includes(next.getUTCDay())) break;
      next.setUTCDate(next.getUTCDate() + 1);
      if (endsAt && next > endsAt) break;
    }
  }

  return {
    recurrence,
    nextRunAt: endsAt && next > endsAt ? null : next.toISOString(),
  };
}

function csvValue(row: Record<string, string>, aliases: string[]): string | undefined {
  const entry = Object.entries(row).find(([key]) => aliases.includes(key.trim().toLowerCase().replace(/[ _-]+/g, '')));
  return entry?.[1]?.trim() || undefined;
}

export async function parseImportRows(file: Express.Multer.File | undefined, csvData: unknown): Promise<Record<string, string>[]> {
  if (!file) {
    const rawCsv = text(csvData, 'CSV data', 1_000_000);
    return parse(rawCsv, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  }

  if (file.originalname.toLowerCase().endsWith('.csv')) {
    return parse(file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true, bom: true });
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) return [];

  const headers = worksheet.getRow(1).values as unknown[];
  const rows: Record<string, string>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    headers.forEach((header, column) => {
      if (column === 0 || header === undefined || header === null) return;
      const cell = row.getCell(column);
      const key = String(header).trim();
      const value = cell.text.trim();
      if (key) record[key] = value;
    });
    if (Object.values(record).some(Boolean)) rows.push(record);
  });
  return rows;
}

router.get('/shared/:token', asyncHandler(async (req: Request, res: Response) => {
  const { data: share, error: shareError } = await supabaseAdmin
    .from('planner_route_shares')
    .select('id, route_id, permission, expires_at, revoked_at')
    .eq('token', req.params['token'])
    .maybeSingle();
  if (shareError) throw createError(shareError.message, 500, 'SHARE_READ_FAILED');
  if (!share || share.revoked_at || (share.expires_at && new Date(share.expires_at) <= new Date())) {
    throw createError('Shared route is unavailable or expired', 404, 'SHARE_NOT_FOUND');
  }

  const { data: route, error: routeError } = await supabaseAdmin
    .from('planner_routes')
    .select('id, name, stops, options, last_optimized_result, status, current_version, updated_at')
    .eq('id', share.route_id)
    .single();
  if (routeError) throw createError(routeError.message, 500, 'SHARED_ROUTE_READ_FAILED');

  let execution = null;
  if (share.permission === 'track') {
    const { data, error } = await supabaseAdmin
      .from('planner_route_executions')
      .select('id, status, planned_start_at, started_at, completed_at, planned_snapshot, stop_progress, updated_at')
      .eq('route_id', share.route_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw createError(error.message, 500, 'SHARED_EXECUTION_READ_FAILED');
    execution = data;
  }

  res.json({ success: true, data: { route, permission: share.permission, execution } });
}));

router.use(authenticate);

router.get('/profile', asyncHandler(async (req: Request, res: Response) => {
  const ownerId = userId(req);
  const { data, error } = await supabaseAdmin
    .from('planner_profiles')
    .select('*')
    .eq('user_id', ownerId)
    .maybeSingle();
  if (error) throw createError(error.message, 500, 'PLANNER_PROFILE_READ_FAILED');
  res.json({ success: true, data });
}));

router.put('/profile', asyncHandler(async (req: Request, res: Response) => {
  const ownerId = userId(req);
  const slots = Number(req.body.defaultVehicleSlots ?? 1);
  if (!Number.isInteger(slots) || slots < 1 || slots > 100) {
    throw createError('Vehicle capacity must be between 1 and 100', 400, 'INVALID_INPUT');
  }
  const { data, error } = await supabaseAdmin
    .from('planner_profiles')
    .upsert({
      user_id: ownerId,
      business_name: typeof req.body.businessName === 'string' ? req.body.businessName.trim().slice(0, 160) || null : null,
      default_vehicle_type: typeof req.body.defaultVehicleType === 'string' ? req.body.defaultVehicleType : 'default',
      default_vehicle_slots: slots,
      onboarding_completed: req.body.onboardingCompleted === true,
    }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw createError(error.message, 500, 'PLANNER_PROFILE_SAVE_FAILED');
  res.json({ success: true, data });
}));

router.get('/locations', asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('planner_saved_locations')
    .select(LOCATION_COLUMNS)
    .eq('user_id', userId(req))
    .order('name');
  if (error) throw createError(error.message, 500, 'LOCATION_LIST_FAILED');
  res.json({ success: true, data: data ?? [] });
}));

router.post('/locations', asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('planner_saved_locations')
    .insert({
      user_id: userId(req),
      name: text(req.body.name, 'Location name', 120),
      address: text(req.body.address, 'Address', 500),
      latitude: optionalCoordinate(req.body.latitude, -90, 90, 'Latitude'),
      longitude: optionalCoordinate(req.body.longitude, -180, 180, 'Longitude'),
      notes: typeof req.body.notes === 'string' ? req.body.notes.trim().slice(0, 1000) || null : null,
    })
    .select(LOCATION_COLUMNS)
    .single();
  if (error) throw createError(error.message, error.code === '23505' ? 409 : 500, 'LOCATION_CREATE_FAILED');
  res.status(201).json({ success: true, data });
}));

router.patch('/locations/:id', asyncHandler(async (req: Request, res: Response) => {
  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates['name'] = text(req.body.name, 'Location name', 120);
  if (req.body.address !== undefined) updates['address'] = text(req.body.address, 'Address', 500);
  if (req.body.latitude !== undefined) updates['latitude'] = optionalCoordinate(req.body.latitude, -90, 90, 'Latitude');
  if (req.body.longitude !== undefined) updates['longitude'] = optionalCoordinate(req.body.longitude, -180, 180, 'Longitude');
  if (req.body.notes !== undefined) updates['notes'] = typeof req.body.notes === 'string' ? req.body.notes.trim().slice(0, 1000) || null : null;
  const { data, error } = await supabaseAdmin
    .from('planner_saved_locations')
    .update(updates)
    .eq('id', req.params['id'])
    .eq('user_id', userId(req))
    .select(LOCATION_COLUMNS)
    .maybeSingle();
  if (error) throw createError(error.message, 500, 'LOCATION_UPDATE_FAILED');
  if (!data) throw createError('Saved location not found', 404, 'NOT_FOUND');
  res.json({ success: true, data });
}));

router.delete('/locations/:id', asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('planner_saved_locations')
    .delete()
    .eq('id', req.params['id'])
    .eq('user_id', userId(req))
    .select('id')
    .maybeSingle();
  if (error) throw createError(error.message, 500, 'LOCATION_DELETE_FAILED');
  if (!data) throw createError('Saved location not found', 404, 'NOT_FOUND');
  res.status(204).send();
}));

router.post('/import', importUpload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  let rows: Record<string, string>[];
  try {
    rows = await parseImportRows(req.file, req.body.csvData);
  } catch (error) {
    throw createError(error instanceof Error ? error.message : 'File parsing failed', 400, 'INVALID_IMPORT');
  }
  if (rows.length === 0 || rows.length > MAX_STOPS) {
    throw createError(`File must contain between 1 and ${MAX_STOPS} data rows`, 400, 'INVALID_IMPORT');
  }

  const stops = rows.map((row, index) => {
    const address = csvValue(row, ['address', 'fulladdress', 'location', 'destination']);
    if (!address) throw createError(`Row ${index + 2} is missing an address`, 400, 'INVALID_IMPORT');
    return {
      id: `imported-${index + 1}`,
      name: csvValue(row, ['name', 'label', 'customer', 'stopname']) ?? `Stop ${index + 1}`,
      address,
      type: csvValue(row, ['type', 'stoptype']) ?? 'stop',
      serviceMinutes: Number(csvValue(row, ['serviceminutes', 'duration', 'durationminutes']) ?? 10),
      notes: csvValue(row, ['notes', 'note', 'instructions']),
    };
  });

  if (req.body.saveToAddressBook === true || req.body.saveToAddressBook === 'true') {
    const locations = stops.map(stop => ({
      user_id: userId(req), name: stop.name, address: stop.address, notes: stop.notes ?? null,
    }));
    const { error } = await supabaseAdmin
      .from('planner_saved_locations')
      .upsert(locations, { onConflict: 'user_id,name' });
    if (error) throw createError(error.message, 500, 'CSV_LOCATION_SAVE_FAILED');
  }

  res.json({ success: true, data: { stops, importedCount: stops.length } });
}));

router.get('/routes', asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('planner_routes')
    .select(ROUTE_COLUMNS)
    .eq('user_id', userId(req))
    .order('updated_at', { ascending: false });
  if (error) throw createError(error.message, 500, 'ROUTE_LIST_FAILED');
  res.json({ success: true, data: data ?? [] });
}));

router.get('/routes/:id', asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('planner_routes')
    .select(ROUTE_COLUMNS)
    .eq('id', req.params['id'])
    .eq('user_id', userId(req))
    .maybeSingle();
  if (error) throw createError(error.message, 500, 'ROUTE_READ_FAILED');
  if (!data) throw createError('Route not found', 404, 'NOT_FOUND');
  res.json({ success: true, data });
}));

router.post('/routes', asyncHandler(async (req: Request, res: Response) => {
  const ownerId = userId(req);
  const stops = normalizeStoredStops(req.body.stops);
  const schedule = normalizeRecurrence(req.body.recurrence);
  await plannerBillingService.assertRouteCreationAllowed(ownerId, stops.length, schedule.recurrence !== null);
  const { data, error } = await supabaseAdmin
    .from('planner_routes')
    .insert({
      user_id: ownerId,
      name: text(req.body.name, 'Route name', 160),
      stops,
      options: typeof req.body.options === 'object' && req.body.options ? req.body.options : {},
      recurrence: schedule.recurrence,
      next_run_at: schedule.nextRunAt,
      is_recurring: schedule.recurrence !== null,
    })
    .select(ROUTE_COLUMNS)
    .single();
  if (error) throw createError(error.message, error.code === '23505' ? 409 : 500, 'ROUTE_CREATE_FAILED');
  await recordRouteVersion(data as PlannerRouteRecord, 'created');
  await plannerBillingService.recordUsage(ownerId, 'route_created', data.id, `route-created:${data.id}`);
  res.status(201).json({ success: true, data });
}));

router.patch('/routes/:id', asyncHandler(async (req: Request, res: Response) => {
  const ownerId = userId(req);
  const existing = await ownedRoute(req.params['id']!, ownerId);
  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates['name'] = text(req.body.name, 'Route name', 160);
  if (req.body.stops !== undefined) updates['stops'] = normalizeStoredStops(req.body.stops);
  if (req.body.options !== undefined) updates['options'] = req.body.options;
  if (req.body.recurrence !== undefined) {
    const schedule = normalizeRecurrence(req.body.recurrence);
    updates['recurrence'] = schedule.recurrence;
    updates['next_run_at'] = schedule.nextRunAt;
    updates['is_recurring'] = schedule.recurrence !== null;
  }
  await plannerBillingService.assertRouteAllowed(
    ownerId,
    (updates['stops'] as PlannerStopInput[] | undefined)?.length ?? existing.stops.length,
    (updates['is_recurring'] as boolean | undefined) ?? existing.recurrence !== null
  );
  updates['current_version'] = existing.current_version + 1;
  if (existing.status === 'completed' || existing.status === 'cancelled') updates['status'] = 'draft';
  const { data, error } = await supabaseAdmin
    .from('planner_routes')
    .update(updates)
    .eq('id', req.params['id'])
    .eq('user_id', ownerId)
    .select(ROUTE_COLUMNS)
    .maybeSingle();
  if (error) throw createError(error.message, error.code === '23505' ? 409 : 500, 'ROUTE_UPDATE_FAILED');
  if (!data) throw createError('Route not found', 404, 'NOT_FOUND');
  await recordRouteVersion(data as PlannerRouteRecord, 'edit');
  res.json({ success: true, data });
}));

router.get('/routes/:id/versions', asyncHandler(async (req: Request, res: Response) => {
  await ownedRoute(req.params['id']!, userId(req));
  const { data, error } = await supabaseAdmin
    .from('planner_route_versions')
    .select('id, route_id, version_number, change_type, snapshot, created_at')
    .eq('route_id', req.params['id'])
    .eq('user_id', userId(req))
    .order('version_number', { ascending: false });
  if (error) throw createError(error.message, 500, 'ROUTE_VERSION_LIST_FAILED');
  res.json({ success: true, data: data ?? [] });
}));

router.post('/routes/:id/versions/:version/restore', asyncHandler(async (req: Request, res: Response) => {
  const ownerId = userId(req);
  const route = await ownedRoute(req.params['id']!, ownerId);
  const versionNumber = Number(req.params['version']);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    throw createError('Version must be a positive integer', 400, 'INVALID_INPUT');
  }
  const { data: version, error: versionError } = await supabaseAdmin
    .from('planner_route_versions')
    .select('snapshot')
    .eq('route_id', route.id)
    .eq('user_id', ownerId)
    .eq('version_number', versionNumber)
    .maybeSingle();
  if (versionError) throw createError(versionError.message, 500, 'ROUTE_VERSION_READ_FAILED');
  if (!version) throw createError('Route version not found', 404, 'NOT_FOUND');

  const snapshot = version.snapshot as Record<string, unknown>;
  const restoredStops = normalizeStoredStops(snapshot['stops']);
  const restoredRecurrence = snapshot['recurrence'] ?? null;
  await plannerBillingService.assertRouteAllowed(ownerId, restoredStops.length, restoredRecurrence !== null);
  const { data, error } = await supabaseAdmin
    .from('planner_routes')
    .update({
      name: text(snapshot['name'], 'Route name', 160),
      stops: restoredStops,
      options: snapshot['options'] && typeof snapshot['options'] === 'object' ? snapshot['options'] : {},
      recurrence: restoredRecurrence,
      last_optimized_result: snapshot['optimizedResult'] ?? null,
      current_version: route.current_version + 1,
      status: 'draft',
      completed_at: null,
    })
    .eq('id', route.id)
    .eq('user_id', ownerId)
    .select(ROUTE_COLUMNS)
    .single();
  if (error) throw createError(error.message, 500, 'ROUTE_VERSION_RESTORE_FAILED');
  await recordRouteVersion(data as PlannerRouteRecord, 'restored');
  res.json({ success: true, data });
}));

router.post('/routes/:id/dispatch', asyncHandler(async (req: Request, res: Response) => {
  const ownerId = userId(req);
  const route = await ownedRoute(req.params['id']!, ownerId);
  await plannerBillingService.assertRouteAllowed(ownerId, route.stops.length, route.recurrence !== null);
  if (route.status === 'dispatched' || route.status === 'in_progress') {
    throw createError('This route already has an active dispatch', 409, 'ROUTE_ALREADY_DISPATCHED');
  }
  const plannedStartAt = optionalIsoDate(req.body.plannedStartAt, 'Planned start');
  const progress = plannedStops(route);
  const { data: execution, error } = await supabaseAdmin
    .from('planner_route_executions')
    .insert({
      route_id: route.id,
      user_id: ownerId,
      version_number: route.current_version,
      status: 'dispatched',
      planned_start_at: plannedStartAt,
      planned_snapshot: routeSnapshot(route),
      stop_progress: progress,
    })
    .select('*')
    .single();
  if (error) throw createError(error.message, 500, 'ROUTE_DISPATCH_FAILED');

  const { error: routeError } = await supabaseAdmin
    .from('planner_routes')
    .update({ status: 'dispatched', dispatched_at: new Date().toISOString(), completed_at: null })
    .eq('id', route.id)
    .eq('user_id', ownerId);
  if (routeError) throw createError(routeError.message, 500, 'ROUTE_STATUS_UPDATE_FAILED');
  await plannerBillingService.recordUsage(ownerId, 'route_dispatched', route.id, `route-dispatched:${execution.id}`);
  res.status(201).json({ success: true, data: execution });
}));

router.get('/executions', asyncHandler(async (req: Request, res: Response) => {
  let query = supabaseAdmin
    .from('planner_route_executions')
    .select('*')
    .eq('user_id', userId(req))
    .order('created_at', { ascending: false });
  if (typeof req.query['routeId'] === 'string') query = query.eq('route_id', req.query['routeId']);
  const { data, error } = await query;
  if (error) throw createError(error.message, 500, 'EXECUTION_LIST_FAILED');
  res.json({ success: true, data: data ?? [] });
}));

router.get('/executions/:id', asyncHandler(async (req: Request, res: Response) => {
  const execution = await ownedExecution(req.params['id']!, userId(req));
  res.json({ success: true, data: execution });
}));

router.post('/executions/:id/start', asyncHandler(async (req: Request, res: Response) => {
  const execution = await ownedExecution(req.params['id']!, userId(req));
  if (execution.status !== 'dispatched') throw createError('Only dispatched routes can be started', 409, 'INVALID_EXECUTION_STATUS');
  const startedAt = optionalIsoDate(req.body.startedAt, 'Start time') ?? new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('planner_route_executions')
    .update({ status: 'in_progress', started_at: startedAt })
    .eq('id', execution.id)
    .eq('user_id', userId(req))
    .select('*')
    .single();
  if (error) throw createError(error.message, 500, 'EXECUTION_START_FAILED');
  await supabaseAdmin.from('planner_routes').update({ status: 'in_progress' }).eq('id', execution.route_id).eq('user_id', userId(req));
  res.json({ success: true, data });
}));

router.patch('/executions/:id/stops/:stopId', asyncHandler(async (req: Request, res: Response) => {
  const execution = await ownedExecution(req.params['id']!, userId(req));
  if (execution.status !== 'in_progress' && execution.status !== 'dispatched') {
    throw createError('Stops can only be updated on an active route', 409, 'INVALID_EXECUTION_STATUS');
  }
  const action = req.body.action;
  if (!['arrived', 'completed', 'skipped'].includes(action)) {
    throw createError('Stop action must be arrived, completed, or skipped', 400, 'INVALID_INPUT');
  }
  const timestamp = optionalIsoDate(req.body.timestamp, 'Event time') ?? new Date().toISOString();
  const latitude = optionalCoordinate(req.body.latitude, -90, 90, 'Latitude');
  const longitude = optionalCoordinate(req.body.longitude, -180, 180, 'Longitude');
  const accuracy = req.body.gpsAccuracyMeters === undefined ? undefined : Number(req.body.gpsAccuracyMeters);
  if (accuracy !== undefined && (!Number.isFinite(accuracy) || accuracy < 0)) {
    throw createError('GPS accuracy must be zero or greater', 400, 'INVALID_INPUT');
  }
  const podUrls = req.body.proofOfDeliveryUrls;
  if (podUrls !== undefined && (!Array.isArray(podUrls) || podUrls.length > 10 || podUrls.some(url => typeof url !== 'string' || url.length > 1000))) {
    throw createError('Proof of delivery must contain at most 10 valid URLs', 400, 'INVALID_INPUT');
  }

  let found = false;
  const stopProgress = execution.stop_progress.map(stop => {
    if (stop.stopId !== req.params['stopId']) return stop;
    found = true;
    return {
      ...stop,
      status: action,
      ...(action === 'arrived' ? { arrivedAt: timestamp } : {}),
      ...(action === 'completed' ? { completedAt: timestamp, arrivedAt: stop.arrivedAt ?? timestamp } : {}),
      ...(action === 'skipped' ? { skippedAt: timestamp } : {}),
      ...(latitude !== undefined ? { actualLatitude: latitude } : {}),
      ...(longitude !== undefined ? { actualLongitude: longitude } : {}),
      ...(accuracy !== undefined ? { gpsAccuracyMeters: accuracy } : {}),
      ...(podUrls !== undefined ? { proofOfDeliveryUrls: podUrls } : {}),
      ...(typeof req.body.notes === 'string' ? { notes: req.body.notes.trim().slice(0, 2000) } : {}),
    } as ExecutionStopProgress;
  });
  if (!found) throw createError('Execution stop not found', 404, 'NOT_FOUND');

  const allFinished = stopProgress.every(stop => stop.status === 'completed' || stop.status === 'skipped');
  const completedAt = allFinished ? new Date().toISOString() : null;
  const { data, error } = await supabaseAdmin
    .from('planner_route_executions')
    .update({
      stop_progress: stopProgress,
      status: allFinished ? 'completed' : 'in_progress',
      started_at: execution.started_at ?? timestamp,
      completed_at: completedAt,
    })
    .eq('id', execution.id)
    .eq('user_id', userId(req))
    .select('*')
    .single();
  if (error) throw createError(error.message, 500, 'STOP_PROGRESS_UPDATE_FAILED');
  await supabaseAdmin.from('planner_routes').update({ status: allFinished ? 'completed' : 'in_progress', completed_at: completedAt }).eq('id', execution.route_id).eq('user_id', userId(req));
  res.json({ success: true, data });
}));

router.post('/executions/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const execution = await ownedExecution(req.params['id']!, userId(req));
  if (execution.status === 'completed') throw createError('Completed routes cannot be cancelled', 409, 'INVALID_EXECUTION_STATUS');
  const { data, error } = await supabaseAdmin
    .from('planner_route_executions')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', execution.id)
    .eq('user_id', userId(req))
    .select('*')
    .single();
  if (error) throw createError(error.message, 500, 'EXECUTION_CANCEL_FAILED');
  await supabaseAdmin.from('planner_routes').update({ status: 'cancelled' }).eq('id', execution.route_id).eq('user_id', userId(req));
  res.json({ success: true, data });
}));

router.get('/executions/:id/report', asyncHandler(async (req: Request, res: Response) => {
  const execution = await ownedExecution(req.params['id']!, userId(req));
  const summary = execution.planned_snapshot['optimizedResult'] as Record<string, unknown> | undefined;
  const plannedSummary = summary?.['summary'] as Record<string, unknown> | undefined;
  const stopAnalysis = execution.stop_progress.map(stop => {
    const planned = stop.plannedArrival ? new Date(stop.plannedArrival).getTime() : Number.NaN;
    const actual = stop.arrivedAt ? new Date(stop.arrivedAt).getTime() : Number.NaN;
    const arrivalVarianceMinutes = Number.isFinite(planned) && Number.isFinite(actual) ? Math.round((actual - planned) / 60_000) : null;
    return { ...stop, arrivalVarianceMinutes, onTime: arrivalVarianceMinutes === null ? null : arrivalVarianceMinutes <= 5 };
  });
  const actualDurationMinutes = execution.started_at && execution.completed_at
    ? Math.round((new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()) / 60_000)
    : null;
  res.json({
    success: true,
    data: {
      executionId: execution.id,
      status: execution.status,
      plannedDistanceMiles: Number(plannedSummary?.['totalDistance'] ?? 0),
      actualDistanceMiles: execution.actual_distance_miles,
      plannedDurationMinutes: Number(plannedSummary?.['totalDuration'] ?? 0),
      actualDurationMinutes,
      completedStops: stopAnalysis.filter(stop => stop.status === 'completed').length,
      skippedStops: stopAnalysis.filter(stop => stop.status === 'skipped').length,
      stopAnalysis,
    },
  });
}));

router.post('/executions/:id/complete', asyncHandler(async (req: Request, res: Response) => {
  const execution = await ownedExecution(req.params['id']!, userId(req));
  if (execution.status === 'cancelled') throw createError('Cancelled routes cannot be completed', 409, 'INVALID_EXECUTION_STATUS');
  const actualDistanceMiles = req.body.actualDistanceMiles === undefined ? execution.actual_distance_miles : Number(req.body.actualDistanceMiles);
  if (actualDistanceMiles !== null && (!Number.isFinite(actualDistanceMiles) || actualDistanceMiles < 0)) {
    throw createError('Actual distance must be zero or greater', 400, 'INVALID_INPUT');
  }
  const completedAt = optionalIsoDate(req.body.completedAt, 'Completion time') ?? new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('planner_route_executions')
    .update({ status: 'completed', completed_at: completedAt, actual_distance_miles: actualDistanceMiles })
    .eq('id', execution.id)
    .eq('user_id', userId(req))
    .select('*')
    .single();
  if (error) throw createError(error.message, 500, 'EXECUTION_COMPLETE_FAILED');
  await supabaseAdmin.from('planner_routes').update({ status: 'completed', completed_at: completedAt }).eq('id', execution.route_id).eq('user_id', userId(req));
  res.json({ success: true, data });
}));

router.post('/executions/:id/reoptimize', asyncHandler(async (req: Request, res: Response) => {
  const ownerId = userId(req);
  const execution = await ownedExecution(req.params['id']!, ownerId);
  if (execution.status !== 'dispatched' && execution.status !== 'in_progress') {
    throw createError('Only active routes can be reoptimized', 409, 'INVALID_EXECUTION_STATUS');
  }
  const route = await ownedRoute(execution.route_id, ownerId);
  const remaining = execution.stop_progress.filter(stop => stop.status !== 'completed' && stop.status !== 'skipped');
  if (remaining.length < 2) throw createError('At least two unfinished stops are required to reoptimize', 409, 'NOT_ENOUGH_STOPS');
  await plannerBillingService.assertRouteAllowed(ownerId, remaining.length, route.recurrence !== null);

  const currentLocation = req.body.currentLocation && typeof req.body.currentLocation === 'object'
    ? req.body.currentLocation as Record<string, unknown>
    : null;
  const stops: RouteStop[] = remaining.map((stop, index) => ({
    id: stop.stopId,
    address: index === 0 && currentLocation?.['address'] ? text(currentLocation['address'], 'Current location', 500) : stop.address,
    type: index === 0 ? 'current_location' : 'stop',
    estimatedDuration: stop.plannedServiceMinutes,
    latitude: index === 0 ? optionalCoordinate(currentLocation?.['latitude'], -90, 90, 'Current latitude') : stop.actualLatitude,
    longitude: index === 0 ? optionalCoordinate(currentLocation?.['longitude'], -180, 180, 'Current longitude') : stop.actualLongitude,
    vehicleInfo: stop.name,
  }));
  const result = await optimizeWithLiveEvidence(stops, route.options);
  const nextVersion = route.current_version + 1;
  const { data: updatedRoute, error: routeError } = await supabaseAdmin
    .from('planner_routes')
    .update({ last_optimized_result: result, last_optimized_at: new Date().toISOString(), current_version: nextVersion })
    .eq('id', route.id)
    .eq('user_id', ownerId)
    .select(ROUTE_COLUMNS)
    .single();
  if (routeError) throw createError(routeError.message, 500, 'REOPTIMIZATION_SAVE_FAILED');
  await recordRouteVersion(updatedRoute as PlannerRouteRecord, 'reoptimized');

  const reordered = result.stops.map((stop, index) => {
    const previous = execution.stop_progress.find(item => item.stopId === stop.id);
    return {
      stopId: stop.id,
      order: index + 1,
      name: stop.vehicleInfo,
      address: stop.address,
      plannedArrival: stop.estimatedArrival,
      plannedServiceMinutes: stop.estimatedDuration ?? previous?.plannedServiceMinutes ?? 0,
      status: previous?.status ?? 'pending',
      ...(previous?.arrivedAt ? { arrivedAt: previous.arrivedAt } : {}),
    } as ExecutionStopProgress;
  });
  const finished = execution.stop_progress.filter(stop => stop.status === 'completed' || stop.status === 'skipped');
  const auditEntry = {
    versionNumber: nextVersion,
    reoptimizedAt: new Date().toISOString(),
    remainingStops: remaining.length,
    previousSummary: (execution.planned_snapshot['optimizedResult'] as Record<string, unknown> | undefined)?.['summary'] ?? null,
    newSummary: result.summary,
  };
  const { data, error } = await supabaseAdmin
    .from('planner_route_executions')
    .update({
      version_number: nextVersion,
      planned_snapshot: { ...routeSnapshot(updatedRoute as PlannerRouteRecord), optimizedResult: result },
      stop_progress: [...finished, ...reordered.filter(stop => !finished.some(done => done.stopId === stop.stopId))],
      reoptimizations: [...(execution.reoptimizations ?? []), auditEntry],
    })
    .eq('id', execution.id)
    .eq('user_id', ownerId)
    .select('*')
    .single();
  if (error) throw createError(error.message, 500, 'EXECUTION_REOPTIMIZATION_FAILED');
  await plannerBillingService.recordUsage(ownerId, 'route_optimized', route.id, `route-reoptimized:${execution.id}:${nextVersion}`);
  res.json({ success: true, data: { execution: data, optimizedRoute: result, audit: auditEntry } });
}));

router.get('/routes/:id/shares', asyncHandler(async (req: Request, res: Response) => {
  await ownedRoute(req.params['id']!, userId(req));
  const { data, error } = await supabaseAdmin
    .from('planner_route_shares')
    .select('id, token, permission, expires_at, revoked_at, created_at')
    .eq('route_id', req.params['id'])
    .eq('user_id', userId(req))
    .order('created_at', { ascending: false });
  if (error) throw createError(error.message, 500, 'SHARE_LIST_FAILED');
  res.json({ success: true, data: data ?? [] });
}));

router.post('/routes/:id/shares', asyncHandler(async (req: Request, res: Response) => {
  const ownerId = userId(req);
  const route = await ownedRoute(req.params['id']!, ownerId);
  await plannerBillingService.assertSharingAllowed(ownerId);
  const permission = req.body.permission ?? 'view';
  if (permission !== 'view' && permission !== 'track') throw createError('Share permission must be view or track', 400, 'INVALID_INPUT');
  const expiresAt = optionalIsoDate(req.body.expiresAt, 'Expiration');
  const { data, error } = await supabaseAdmin
    .from('planner_route_shares')
    .insert({ route_id: route.id, user_id: ownerId, permission, expires_at: expiresAt })
    .select('id, token, permission, expires_at, created_at')
    .single();
  if (error) throw createError(error.message, 500, 'SHARE_CREATE_FAILED');
  res.status(201).json({ success: true, data });
}));

router.delete('/routes/:routeId/shares/:shareId', asyncHandler(async (req: Request, res: Response) => {
  await ownedRoute(req.params['routeId']!, userId(req));
  const { data, error } = await supabaseAdmin
    .from('planner_route_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', req.params['shareId'])
    .eq('route_id', req.params['routeId'])
    .eq('user_id', userId(req))
    .select('id')
    .maybeSingle();
  if (error) throw createError(error.message, 500, 'SHARE_REVOKE_FAILED');
  if (!data) throw createError('Route share not found', 404, 'NOT_FOUND');
  res.status(204).send();
}));

router.get('/routes/:id/export', asyncHandler(async (req: Request, res: Response) => {
  const route = await ownedRoute(req.params['id']!, userId(req));
  const format = req.query['format'] === 'csv' ? 'csv' : 'json';
  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${route.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-v${route.current_version}.json"`);
    res.json({ route: routeSnapshot(route), status: route.status, version: route.current_version });
    return;
  }
  const rows = ['order,name,address,type,service_minutes,planned_arrival'];
  plannedStops(route).forEach(stop => rows.push([
    stop.order,
    stop.name,
    stop.address,
    route.stops.find(item => item.id === stop.stopId)?.type ?? 'stop',
    stop.plannedServiceMinutes,
    stop.plannedArrival,
  ].map(csvCell).join(',')));
  res.type('text/csv').setHeader('Content-Disposition', `attachment; filename="${route.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-v${route.current_version}.csv"`);
  res.send(rows.join('\r\n'));
}));

router.delete('/routes/:id', asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('planner_routes')
    .delete()
    .eq('id', req.params['id'])
    .eq('user_id', userId(req))
    .select('id')
    .maybeSingle();
  if (error) throw createError(error.message, 500, 'ROUTE_DELETE_FAILED');
  if (!data) throw createError('Route not found', 404, 'NOT_FOUND');
  res.status(204).send();
}));

router.post('/optimize', asyncHandler(async (req: Request, res: Response) => {
  const ownerId = userId(req);
  const stops = normalizeStops(req.body.stops);
  await plannerBillingService.assertRouteAllowed(ownerId, stops.length);
  const options = req.body.options && typeof req.body.options === 'object' ? req.body.options : {};
  const result = await optimizeWithLiveEvidence(stops, options);

  if (typeof req.body.routeId === 'string') {
    const route = await ownedRoute(req.body.routeId, ownerId);
    const { data, error } = await supabaseAdmin
      .from('planner_routes')
      .update({
        last_optimized_result: result,
        last_optimized_at: new Date().toISOString(),
        status: 'planned',
        current_version: route.current_version + 1,
      })
      .eq('id', req.body.routeId)
      .eq('user_id', ownerId)
      .select(ROUTE_COLUMNS)
      .maybeSingle();
    if (error) throw createError(error.message, 500, 'ROUTE_RESULT_SAVE_FAILED');
    if (!data) throw createError('Route not found', 404, 'NOT_FOUND');
    await recordRouteVersion(data as PlannerRouteRecord, 'optimized');
    await plannerBillingService.recordUsage(ownerId, 'route_optimized', route.id, `route-optimized:${route.id}:${data.current_version}`);
  }

  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
}));

export default router;