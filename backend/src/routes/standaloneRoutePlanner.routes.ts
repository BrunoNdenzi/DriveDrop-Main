import { Router, Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import multer from 'multer';
import { authenticate } from '@middlewares/auth.middleware';
import { supabaseAdmin } from '@lib/supabase';
import { asyncHandler, createError } from '@utils/error';
import { routeOptimizationService, RouteStop } from '../services/RouteOptimizationService';

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

const ROUTE_COLUMNS = 'id, user_id, name, stops, options, recurrence, next_run_at, is_recurring, last_optimized_result, last_optimized_at, created_at, updated_at';
const LOCATION_COLUMNS = 'id, user_id, name, address, latitude, longitude, notes, created_at, updated_at';

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
  const stops = normalizeStoredStops(req.body.stops);
  const schedule = normalizeRecurrence(req.body.recurrence);
  const { data, error } = await supabaseAdmin
    .from('planner_routes')
    .insert({
      user_id: userId(req),
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
  res.status(201).json({ success: true, data });
}));

router.patch('/routes/:id', asyncHandler(async (req: Request, res: Response) => {
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
  const { data, error } = await supabaseAdmin
    .from('planner_routes')
    .update(updates)
    .eq('id', req.params['id'])
    .eq('user_id', userId(req))
    .select(ROUTE_COLUMNS)
    .maybeSingle();
  if (error) throw createError(error.message, error.code === '23505' ? 409 : 500, 'ROUTE_UPDATE_FAILED');
  if (!data) throw createError('Route not found', 404, 'NOT_FOUND');
  res.json({ success: true, data });
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
  const stops = normalizeStops(req.body.stops);
  const result = await routeOptimizationService.optimizeRoute(stops, req.body.options ?? {});

  if (typeof req.body.routeId === 'string') {
    const { data, error } = await supabaseAdmin
      .from('planner_routes')
      .update({ last_optimized_result: result, last_optimized_at: new Date().toISOString() })
      .eq('id', req.body.routeId)
      .eq('user_id', userId(req))
      .select('id')
      .maybeSingle();
    if (error) throw createError(error.message, 500, 'ROUTE_RESULT_SAVE_FAILED');
    if (!data) throw createError('Route not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, data: result, timestamp: new Date().toISOString() });
}));

export default router;