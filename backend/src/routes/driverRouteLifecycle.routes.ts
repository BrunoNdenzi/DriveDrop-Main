import { Router, Request, Response } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { supabaseAdmin } from '@lib/supabase';
import { asyncHandler, createError } from '@utils/error';
import { routeOptimizationService, RouteStop } from '../services/RouteOptimizationService';
import { pricingLiveEvidenceService } from '../services/pricingLiveEvidence.service';

const router = Router();
const ROUTABLE_STATUSES = ['accepted', 'assigned', 'picked_up', 'in_transit'];
const ROUTE_COLUMNS = 'id, driver_id, name, shipment_ids, stops, options, last_optimized_result, last_optimized_at, status, current_version, dispatched_at, completed_at, created_at, updated_at';

type RouteStatus = 'draft' | 'planned' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
type ExecutionStatus = 'dispatched' | 'in_progress' | 'completed' | 'cancelled';

interface ShipmentRecord {
  id: string;
  pickup_address: string;
  delivery_address: string;
  title: string | null;
  status: string;
  pickup_date: string | null;
  delivery_date: string | null;
  driver_offer_amount: number | null;
}

interface DriverRouteRecord {
  id: string;
  driver_id: string;
  name: string;
  shipment_ids: string[];
  stops: RouteStop[];
  options: Record<string, unknown>;
  last_optimized_result: Record<string, unknown> | null;
  status: RouteStatus;
  current_version: number;
}

interface StopProgress {
  stopId: string;
  shipmentId?: string;
  type: RouteStop['type'];
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

interface DriverExecutionRecord {
  id: string;
  route_id: string;
  driver_id: string;
  version_number: number;
  status: ExecutionStatus;
  planned_start_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  planned_snapshot: Record<string, unknown>;
  stop_progress: StopProgress[];
  reoptimizations: Record<string, unknown>[];
  actual_distance_miles: number | null;
}

function ownerId(req: Request): string {
  if (!req.user?.id) throw createError('Authentication required', 401, 'UNAUTHORIZED');
  if (req.user.role !== 'driver' && req.user.role !== 'admin') {
    throw createError('Driver or admin access required', 403, 'FORBIDDEN');
  }
  return req.user.id;
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw createError(`${field} is required`, 400, 'INVALID_INPUT');
  const normalized = value.trim();
  if (normalized.length > maxLength) throw createError(`${field} must be ${maxLength} characters or fewer`, 400, 'INVALID_INPUT');
  return normalized;
}

function optionalIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw createError(`${field} must be a valid date`, 400, 'INVALID_INPUT');
  return date.toISOString();
}

function optionalCoordinate(value: unknown, min: number, max: number, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) throw createError(`${field} is invalid`, 400, 'INVALID_INPUT');
  return coordinate;
}

function csvCell(value: unknown): string {
  const normalized = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function dayWindow(value: string | null): RouteStop['timeWindow'] {
  if (!value) return undefined;
  const date = value.slice(0, 10);
  const earliest = new Date(`${date}T00:00:00.000Z`);
  const latest = new Date(`${date}T23:59:59.999Z`);
  if (Number.isNaN(earliest.getTime()) || Number.isNaN(latest.getTime())) return undefined;
  return { earliest: earliest.toISOString(), latest: latest.toISOString() };
}

async function assignedShipments(ids: unknown, driverId: string, isAdmin: boolean, requireRoutable = true): Promise<ShipmentRecord[]> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50 || ids.some(id => typeof id !== 'string')) {
    throw createError('Between 1 and 50 valid shipment IDs are required', 400, 'INVALID_SHIPMENTS');
  }
  const uniqueIds = [...new Set(ids as string[])];
  let query = supabaseAdmin
    .from('shipments')
    .select('id, pickup_address, delivery_address, title, status, pickup_date, delivery_date, driver_offer_amount')
    .in('id', uniqueIds);
  if (requireRoutable) query = query.in('status', ROUTABLE_STATUSES);
  if (!isAdmin) query = query.eq('driver_id', driverId);
  const { data, error } = await query;
  if (error) throw createError(error.message, 500, 'SHIPMENT_READ_FAILED');
  if ((data ?? []).length !== uniqueIds.length) throw createError('One or more shipments are unavailable or not assigned to this driver', 403, 'SHIPMENT_FORBIDDEN');
  const byId = new Map((data as ShipmentRecord[]).map(shipment => [shipment.id, shipment]));
  return uniqueIds.map(id => byId.get(id)!);
}

function buildStops(driverLocation: string, shipments: ShipmentRecord[]): RouteStop[] {
  const stops: RouteStop[] = [{ id: 'driver-start', address: driverLocation, type: 'current_location', estimatedDuration: 0 }];
  for (const shipment of shipments) {
    if (shipment.status === 'accepted' || shipment.status === 'assigned') {
      stops.push({
        id: `pickup-${shipment.id}`,
        address: shipment.pickup_address,
        type: 'pickup',
        shipmentId: shipment.id,
        vehicleInfo: shipment.title ?? undefined,
        timeWindow: dayWindow(shipment.pickup_date),
        estimatedDuration: 20,
      });
    }
    stops.push({
      id: `delivery-${shipment.id}`,
      address: shipment.delivery_address,
      type: 'delivery',
      shipmentId: shipment.id,
      vehicleInfo: shipment.title ?? undefined,
      timeWindow: dayWindow(shipment.delivery_date),
      estimatedDuration: 15,
    });
  }
  return stops;
}

async function ownedRoute(routeId: string, driverId: string, isAdmin = false): Promise<DriverRouteRecord> {
  let query = supabaseAdmin.from('driver_routes').select(ROUTE_COLUMNS).eq('id', routeId);
  if (!isAdmin) query = query.eq('driver_id', driverId);
  const { data, error } = await query.maybeSingle();
  if (error) throw createError(error.message, 500, 'DRIVER_ROUTE_READ_FAILED');
  if (!data) throw createError('Driver route not found', 404, 'NOT_FOUND');
  return data as DriverRouteRecord;
}

async function ownedExecution(executionId: string, driverId: string, isAdmin = false): Promise<DriverExecutionRecord> {
  let query = supabaseAdmin.from('driver_route_executions').select('*').eq('id', executionId);
  if (!isAdmin) query = query.eq('driver_id', driverId);
  const { data, error } = await query.maybeSingle();
  if (error) throw createError(error.message, 500, 'DRIVER_EXECUTION_READ_FAILED');
  if (!data) throw createError('Driver route execution not found', 404, 'NOT_FOUND');
  return data as DriverExecutionRecord;
}

function routeSnapshot(route: DriverRouteRecord): Record<string, unknown> {
  return {
    name: route.name,
    shipmentIds: route.shipment_ids,
    stops: route.stops,
    options: route.options,
    optimizedResult: route.last_optimized_result,
  };
}

async function recordVersion(route: DriverRouteRecord, changeType: string): Promise<void> {
  const { error } = await supabaseAdmin.from('driver_route_versions').insert({
    route_id: route.id,
    driver_id: route.driver_id,
    version_number: route.current_version,
    change_type: changeType,
    snapshot: routeSnapshot(route),
  });
  if (error) throw createError(error.message, 500, 'DRIVER_ROUTE_VERSION_SAVE_FAILED');
}

function plannedStops(route: DriverRouteRecord): StopProgress[] {
  const optimizedStops = route.last_optimized_result?.['stops'];
  const source = Array.isArray(optimizedStops) ? optimizedStops : route.stops;
  return source.map((value, index) => {
    const stop = value as Record<string, unknown>;
    return {
      stopId: String(stop['id'] ?? `stop-${index + 1}`),
      ...(typeof stop['shipmentId'] === 'string' ? { shipmentId: stop['shipmentId'] } : {}),
      type: (stop['type'] ?? (index === 0 ? 'current_location' : 'stop')) as RouteStop['type'],
      order: Number(stop['order'] ?? index + 1),
      ...(stop['vehicleInfo'] ? { name: String(stop['vehicleInfo']) } : {}),
      address: String(stop['address'] ?? ''),
      ...(stop['estimatedArrival'] ? { plannedArrival: String(stop['estimatedArrival']) } : {}),
      plannedServiceMinutes: Number(stop['estimatedDuration'] ?? 0),
      status: 'pending',
    };
  });
}

async function synchronizeShipment(stop: StopProgress, action: string): Promise<void> {
  if (action !== 'completed' || !stop.shipmentId) return;
  if (stop.type !== 'pickup' && stop.type !== 'delivery') return;
  const nextStatus = stop.type === 'pickup' ? 'picked_up' : 'delivered';
  const allowedCurrent = stop.type === 'pickup' ? ['accepted', 'assigned'] : ['picked_up', 'in_transit'];
  const { data, error } = await supabaseAdmin
    .from('shipments')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', stop.shipmentId)
    .in('status', allowedCurrent)
    .select('id')
    .maybeSingle();
  if (error) throw createError(error.message, 500, 'SHIPMENT_STATUS_SYNC_FAILED');
  if (!data) throw createError(`Shipment cannot transition to ${nextStatus} from its current status`, 409, 'INVALID_SHIPMENT_STATUS');
}

router.get('/shared/:token', asyncHandler(async (req: Request, res: Response) => {
  const { data: share, error: shareError } = await supabaseAdmin
    .from('driver_route_shares')
    .select('route_id, permission, expires_at, revoked_at')
    .eq('token', req.params['token'])
    .maybeSingle();
  if (shareError) throw createError(shareError.message, 500, 'SHARE_READ_FAILED');
  if (!share || share.revoked_at || (share.expires_at && new Date(share.expires_at) <= new Date())) {
    throw createError('Shared route is unavailable or expired', 404, 'SHARE_NOT_FOUND');
  }
  const { data: route, error: routeError } = await supabaseAdmin
    .from('driver_routes')
    .select('id, name, stops, last_optimized_result, status, current_version, updated_at')
    .eq('id', share.route_id)
    .single();
  if (routeError) throw createError(routeError.message, 500, 'SHARED_ROUTE_READ_FAILED');
  let execution = null;
  if (share.permission === 'track') {
    const { data, error } = await supabaseAdmin
      .from('driver_route_executions')
      .select('id, status, planned_start_at, started_at, completed_at, stop_progress, updated_at')
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

router.get('/routes', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  let query = supabaseAdmin.from('driver_routes').select(ROUTE_COLUMNS).order('updated_at', { ascending: false });
  if (req.user?.role !== 'admin') query = query.eq('driver_id', driverId);
  const { data, error } = await query;
  if (error) throw createError(error.message, 500, 'DRIVER_ROUTE_LIST_FAILED');
  res.json({ success: true, data: data ?? [] });
}));

router.post('/optimize', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  const shipments = await assignedShipments(req.body.shipmentIds, driverId, req.user?.role === 'admin');
  const driverLocation = text(req.body.driverLocation, 'Driver location', 500);
  const stops = buildStops(driverLocation, shipments);
  const options = req.body.options && typeof req.body.options === 'object' ? req.body.options : {};
  const result = await routeOptimizationService.optimizeRoute(stops, options);
  const payouts = shipments
    .map(shipment => shipment.driver_offer_amount)
    .filter((amount): amount is number => typeof amount === 'number' && amount > 0);
  const liveEvidence = await pricingLiveEvidenceService.collectRoute(result.stops.map(stop => stop.address));
  const optimizedRoute = {
    ...result,
    totalAcceptedPayout: payouts.reduce((sum, amount) => sum + amount, 0),
    payoutShipmentCount: payouts.length,
    missingPayoutCount: shipments.length - payouts.length,
    liveEvidence,
  };
  const routeName = typeof req.body.name === 'string' && req.body.name.trim()
    ? req.body.name.trim().slice(0, 160)
    : `Route ${new Date().toLocaleDateString('en-US')}`;
  const { data, error } = await supabaseAdmin
    .from('driver_routes')
    .insert({
      driver_id: driverId,
      name: routeName,
      shipment_ids: shipments.map(shipment => shipment.id),
      stops,
      options,
      last_optimized_result: optimizedRoute,
      last_optimized_at: new Date().toISOString(),
      status: 'planned',
    })
    .select(ROUTE_COLUMNS)
    .single();
  if (error) throw createError(error.message, 500, 'DRIVER_ROUTE_CREATE_FAILED');
  await recordVersion(data as DriverRouteRecord, 'optimized');
  res.status(201).json({ success: true, data: { route: data, optimizedRoute }, timestamp: new Date().toISOString() });
}));

router.post('/daily-plan', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  const shipments = await assignedShipments(req.body.shipmentIds, driverId, req.user?.role === 'admin');
  const driverLocation = text(req.body.driverLocation, 'Driver location', 500);
  const options = req.body.options && typeof req.body.options === 'object' ? req.body.options : {};
  const planShipments = shipments.map(shipment => ({
    id: shipment.id,
    pickupAddress: shipment.pickup_address,
    deliveryAddress: shipment.delivery_address,
    ...(shipment.title ? { vehicleInfo: shipment.title } : {}),
    estimatedPayout: Number(shipment.driver_offer_amount ?? 0),
    status: shipment.status,
  }));
  const plan = await routeOptimizationService.generateDailyPlan(driverLocation, planShipments, options);
  const payouts = shipments
    .map(shipment => shipment.driver_offer_amount)
    .filter((amount): amount is number => typeof amount === 'number' && amount > 0);
  const savedRoutes: DriverRouteRecord[] = [];
  const routes = [];
  for (const [index, route] of plan.routes.entries()) {
    const liveEvidence = index === 0
      ? await pricingLiveEvidenceService.collectRoute(route.stops.map(stop => stop.address))
      : null;
    const optimizedRoute = { ...route, liveEvidence };
    const shipmentIds = [...new Set(route.stops.map(stop => stop.shipmentId).filter((id): id is string => Boolean(id)))];
    if (shipmentIds.length === 0) continue;
    const { data, error } = await supabaseAdmin
      .from('driver_routes')
      .insert({
        driver_id: driverId,
        name: `Daily Plan ${new Date(plan.date).toLocaleDateString('en-US')} · Route ${index + 1}`,
        shipment_ids: shipmentIds,
        stops: route.stops,
        options,
        last_optimized_result: optimizedRoute,
        last_optimized_at: new Date().toISOString(),
        status: 'planned',
      })
      .select(ROUTE_COLUMNS)
      .single();
    if (error) throw createError(error.message, 500, 'DRIVER_DAILY_PLAN_SAVE_FAILED');
    await recordVersion(data as DriverRouteRecord, 'optimized');
    savedRoutes.push(data as DriverRouteRecord);
    routes.push(optimizedRoute);
  }
  res.status(201).json({
    success: true,
    data: {
      ...plan,
      routes,
      savedRoutes,
      totalAcceptedPayout: payouts.reduce((sum, amount) => sum + amount, 0),
      payoutShipmentCount: payouts.length,
      missingPayoutCount: shipments.length - payouts.length,
    },
    timestamp: new Date().toISOString(),
  });
}));

router.get('/routes/:id', asyncHandler(async (req: Request, res: Response) => {
  const route = await ownedRoute(req.params['id']!, ownerId(req), req.user?.role === 'admin');
  res.json({ success: true, data: route });
}));

router.patch('/routes/:id', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  const route = await ownedRoute(req.params['id']!, driverId, req.user?.role === 'admin');
  if (route.status === 'dispatched' || route.status === 'in_progress') throw createError('Active routes cannot be edited', 409, 'ACTIVE_ROUTE');
  const updates: Record<string, unknown> = { current_version: route.current_version + 1 };
  if (req.body.name !== undefined) updates['name'] = text(req.body.name, 'Route name', 160);
  if (req.body.options !== undefined) updates['options'] = req.body.options && typeof req.body.options === 'object' ? req.body.options : {};
  const { data, error } = await supabaseAdmin
    .from('driver_routes')
    .update(updates)
    .eq('id', route.id)
    .select(ROUTE_COLUMNS)
    .single();
  if (error) throw createError(error.message, 500, 'DRIVER_ROUTE_UPDATE_FAILED');
  await recordVersion(data as DriverRouteRecord, 'edit');
  res.json({ success: true, data });
}));

router.get('/routes/:id/versions', asyncHandler(async (req: Request, res: Response) => {
  const route = await ownedRoute(req.params['id']!, ownerId(req), req.user?.role === 'admin');
  const { data, error } = await supabaseAdmin
    .from('driver_route_versions')
    .select('id, route_id, version_number, change_type, snapshot, created_at')
    .eq('route_id', route.id)
    .order('version_number', { ascending: false });
  if (error) throw createError(error.message, 500, 'DRIVER_ROUTE_VERSION_LIST_FAILED');
  res.json({ success: true, data: data ?? [] });
}));

router.post('/routes/:id/versions/:version/restore', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  const route = await ownedRoute(req.params['id']!, driverId, req.user?.role === 'admin');
  if (route.status === 'dispatched' || route.status === 'in_progress') throw createError('Active routes cannot restore versions', 409, 'ACTIVE_ROUTE');
  const versionNumber = Number(req.params['version']);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) throw createError('Version must be a positive integer', 400, 'INVALID_INPUT');
  const { data: version, error: versionError } = await supabaseAdmin
    .from('driver_route_versions')
    .select('snapshot')
    .eq('route_id', route.id)
    .eq('version_number', versionNumber)
    .maybeSingle();
  if (versionError) throw createError(versionError.message, 500, 'DRIVER_ROUTE_VERSION_READ_FAILED');
  if (!version) throw createError('Driver route version not found', 404, 'NOT_FOUND');
  const snapshot = version.snapshot as Record<string, unknown>;
  await assignedShipments(snapshot['shipmentIds'], route.driver_id, req.user?.role === 'admin', false);
  const { data, error } = await supabaseAdmin
    .from('driver_routes')
    .update({
      name: text(snapshot['name'], 'Route name', 160),
      shipment_ids: snapshot['shipmentIds'],
      stops: snapshot['stops'],
      options: snapshot['options'] ?? {},
      last_optimized_result: snapshot['optimizedResult'] ?? null,
      current_version: route.current_version + 1,
      status: 'planned',
      completed_at: null,
    })
    .eq('id', route.id)
    .select(ROUTE_COLUMNS)
    .single();
  if (error) throw createError(error.message, 500, 'DRIVER_ROUTE_RESTORE_FAILED');
  await recordVersion(data as DriverRouteRecord, 'restored');
  res.json({ success: true, data });
}));

router.post('/routes/:id/dispatch', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  const route = await ownedRoute(req.params['id']!, driverId, req.user?.role === 'admin');
  if (route.status === 'dispatched' || route.status === 'in_progress') throw createError('This route already has an active dispatch', 409, 'ROUTE_ALREADY_DISPATCHED');
  await assignedShipments(route.shipment_ids, route.driver_id, req.user?.role === 'admin');
  const { data: execution, error } = await supabaseAdmin
    .from('driver_route_executions')
    .insert({
      route_id: route.id,
      driver_id: route.driver_id,
      version_number: route.current_version,
      planned_start_at: optionalIsoDate(req.body.plannedStartAt, 'Planned start'),
      planned_snapshot: routeSnapshot(route),
      stop_progress: plannedStops(route),
    })
    .select('*')
    .single();
  if (error) throw createError(error.message, 500, 'DRIVER_ROUTE_DISPATCH_FAILED');
  const { error: routeError } = await supabaseAdmin
    .from('driver_routes')
    .update({ status: 'dispatched', dispatched_at: new Date().toISOString(), completed_at: null })
    .eq('id', route.id);
  if (routeError) throw createError(routeError.message, 500, 'DRIVER_ROUTE_STATUS_FAILED');
  res.status(201).json({ success: true, data: execution });
}));

router.get('/executions', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  let query = supabaseAdmin.from('driver_route_executions').select('*').order('created_at', { ascending: false });
  if (req.user?.role !== 'admin') query = query.eq('driver_id', driverId);
  if (typeof req.query['routeId'] === 'string') query = query.eq('route_id', req.query['routeId']);
  const { data, error } = await query;
  if (error) throw createError(error.message, 500, 'DRIVER_EXECUTION_LIST_FAILED');
  res.json({ success: true, data: data ?? [] });
}));

router.post('/executions/:id/start', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  const execution = await ownedExecution(req.params['id']!, driverId, req.user?.role === 'admin');
  if (execution.status !== 'dispatched') throw createError('Only dispatched routes can be started', 409, 'INVALID_EXECUTION_STATUS');
  const startedAt = optionalIsoDate(req.body.startedAt, 'Start time') ?? new Date().toISOString();
  const { data, error } = await supabaseAdmin.from('driver_route_executions').update({ status: 'in_progress', started_at: startedAt }).eq('id', execution.id).select('*').single();
  if (error) throw createError(error.message, 500, 'DRIVER_EXECUTION_START_FAILED');
  await supabaseAdmin.from('driver_routes').update({ status: 'in_progress' }).eq('id', execution.route_id);
  res.json({ success: true, data });
}));

router.patch('/executions/:id/stops/:stopId', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  const execution = await ownedExecution(req.params['id']!, driverId, req.user?.role === 'admin');
  if (execution.status !== 'in_progress' && execution.status !== 'dispatched') throw createError('Stops can only be updated on an active route', 409, 'INVALID_EXECUTION_STATUS');
  const action = req.body.action;
  if (!['arrived', 'completed', 'skipped'].includes(action)) throw createError('Stop action must be arrived, completed, or skipped', 400, 'INVALID_INPUT');
  const timestamp = optionalIsoDate(req.body.timestamp, 'Event time') ?? new Date().toISOString();
  const latitude = optionalCoordinate(req.body.latitude, -90, 90, 'Latitude');
  const longitude = optionalCoordinate(req.body.longitude, -180, 180, 'Longitude');
  const accuracy = req.body.gpsAccuracyMeters === undefined ? undefined : Number(req.body.gpsAccuracyMeters);
  if (accuracy !== undefined && (!Number.isFinite(accuracy) || accuracy < 0)) throw createError('GPS accuracy must be zero or greater', 400, 'INVALID_INPUT');
  const podUrls = req.body.proofOfDeliveryUrls;
  if (podUrls !== undefined && (!Array.isArray(podUrls) || podUrls.length > 10 || podUrls.some(url => typeof url !== 'string' || url.length > 1000))) {
    throw createError('Proof of delivery must contain at most 10 valid URLs', 400, 'INVALID_INPUT');
  }
  let changedStop: StopProgress | undefined;
  const progress = execution.stop_progress.map(stop => {
    if (stop.stopId !== req.params['stopId']) return stop;
    changedStop = {
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
    } as StopProgress;
    return changedStop;
  });
  if (!changedStop) throw createError('Execution stop not found', 404, 'NOT_FOUND');
  if (changedStop.type === 'delivery' && action === 'completed') {
    const pickup = progress.find(stop => stop.shipmentId === changedStop?.shipmentId && stop.type === 'pickup');
    if (pickup && pickup.status !== 'completed') throw createError('Pickup must be completed before delivery', 409, 'PICKUP_REQUIRED');
  }
  await synchronizeShipment(changedStop, action);
  const allFinished = progress.every(stop => stop.type === 'current_location' || stop.status === 'completed' || stop.status === 'skipped');
  const completedAt = allFinished ? new Date().toISOString() : null;
  const { data, error } = await supabaseAdmin
    .from('driver_route_executions')
    .update({ stop_progress: progress, status: allFinished ? 'completed' : 'in_progress', started_at: execution.started_at ?? timestamp, completed_at: completedAt })
    .eq('id', execution.id)
    .select('*')
    .single();
  if (error) throw createError(error.message, 500, 'DRIVER_STOP_UPDATE_FAILED');
  await supabaseAdmin.from('driver_routes').update({ status: allFinished ? 'completed' : 'in_progress', completed_at: completedAt }).eq('id', execution.route_id);
  res.json({ success: true, data });
}));

router.post('/executions/:id/reoptimize', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  const execution = await ownedExecution(req.params['id']!, driverId, req.user?.role === 'admin');
  if (execution.status !== 'dispatched' && execution.status !== 'in_progress') throw createError('Only active routes can be reoptimized', 409, 'INVALID_EXECUTION_STATUS');
  const route = await ownedRoute(execution.route_id, driverId, req.user?.role === 'admin');
  const remaining = execution.stop_progress.filter(stop => stop.type !== 'current_location' && stop.status !== 'completed' && stop.status !== 'skipped');
  if (remaining.length < 1) throw createError('At least one unfinished stop is required to reoptimize', 409, 'NOT_ENOUGH_STOPS');
  const current = req.body.currentLocation && typeof req.body.currentLocation === 'object' ? req.body.currentLocation as Record<string, unknown> : {};
  const startAddress = typeof current['address'] === 'string' && current['address'].trim()
    ? current['address'].trim()
    : remaining[0]!.address;
  const stops: RouteStop[] = [
    {
      id: 'driver-current',
      address: startAddress,
      type: 'current_location',
      latitude: optionalCoordinate(current['latitude'], -90, 90, 'Current latitude'),
      longitude: optionalCoordinate(current['longitude'], -180, 180, 'Current longitude'),
      estimatedDuration: 0,
    },
    ...remaining.map(stop => ({
      id: stop.stopId,
      address: stop.address,
      type: stop.type,
      shipmentId: stop.shipmentId,
      vehicleInfo: stop.name,
      estimatedDuration: stop.plannedServiceMinutes,
    } as RouteStop)),
  ];
  const result = await routeOptimizationService.optimizeRoute(stops, route.options);
  const nextVersion = route.current_version + 1;
  const { data: updatedRoute, error: routeError } = await supabaseAdmin
    .from('driver_routes')
    .update({ last_optimized_result: result, last_optimized_at: new Date().toISOString(), current_version: nextVersion })
    .eq('id', route.id)
    .select(ROUTE_COLUMNS)
    .single();
  if (routeError) throw createError(routeError.message, 500, 'DRIVER_REOPTIMIZATION_SAVE_FAILED');
  await recordVersion(updatedRoute as DriverRouteRecord, 'reoptimized');
  const finished = execution.stop_progress.filter(stop => stop.status === 'completed' || stop.status === 'skipped');
  const reordered = result.stops
    .filter(stop => stop.type !== 'current_location')
    .map((stop, index) => {
      const previous = execution.stop_progress.find(item => item.stopId === stop.id);
      return {
        ...previous,
        stopId: stop.id,
        shipmentId: stop.shipmentId,
        type: stop.type,
        order: finished.length + index + 1,
        name: stop.vehicleInfo,
        address: stop.address,
        plannedArrival: stop.estimatedArrival,
        plannedServiceMinutes: stop.estimatedDuration ?? previous?.plannedServiceMinutes ?? 0,
        status: previous?.status ?? 'pending',
      } as StopProgress;
    });
  const audit = { versionNumber: nextVersion, reoptimizedAt: new Date().toISOString(), remainingStops: remaining.length, newSummary: result.summary };
  const { data, error } = await supabaseAdmin
    .from('driver_route_executions')
    .update({
      version_number: nextVersion,
      planned_snapshot: routeSnapshot(updatedRoute as DriverRouteRecord),
      stop_progress: [...finished, ...reordered],
      reoptimizations: [...(execution.reoptimizations ?? []), audit],
    })
    .eq('id', execution.id)
    .select('*')
    .single();
  if (error) throw createError(error.message, 500, 'DRIVER_EXECUTION_REOPTIMIZATION_FAILED');
  res.json({ success: true, data: { execution: data, optimizedRoute: result, audit } });
}));

router.post('/executions/:id/complete', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  const execution = await ownedExecution(req.params['id']!, driverId, req.user?.role === 'admin');
  if (execution.status === 'cancelled') throw createError('Cancelled routes cannot be completed', 409, 'INVALID_EXECUTION_STATUS');
  const unfinishedDeliveries = execution.stop_progress.filter(stop => stop.type === 'delivery' && stop.status !== 'completed' && stop.status !== 'skipped');
  if (unfinishedDeliveries.length > 0) throw createError('Complete or skip every delivery before completing the route', 409, 'UNFINISHED_DELIVERIES');
  const actualDistance = req.body.actualDistanceMiles === undefined ? execution.actual_distance_miles : Number(req.body.actualDistanceMiles);
  if (actualDistance !== null && (!Number.isFinite(actualDistance) || actualDistance < 0)) throw createError('Actual distance must be zero or greater', 400, 'INVALID_INPUT');
  const completedAt = optionalIsoDate(req.body.completedAt, 'Completion time') ?? new Date().toISOString();
  const { data, error } = await supabaseAdmin.from('driver_route_executions').update({ status: 'completed', completed_at: completedAt, actual_distance_miles: actualDistance }).eq('id', execution.id).select('*').single();
  if (error) throw createError(error.message, 500, 'DRIVER_EXECUTION_COMPLETE_FAILED');
  await supabaseAdmin.from('driver_routes').update({ status: 'completed', completed_at: completedAt }).eq('id', execution.route_id);
  res.json({ success: true, data });
}));

router.post('/executions/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const driverId = ownerId(req);
  const execution = await ownedExecution(req.params['id']!, driverId, req.user?.role === 'admin');
  if (execution.status === 'completed') throw createError('Completed routes cannot be cancelled', 409, 'INVALID_EXECUTION_STATUS');
  const completedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('driver_route_executions')
    .update({ status: 'cancelled', completed_at: completedAt })
    .eq('id', execution.id)
    .select('*')
    .single();
  if (error) throw createError(error.message, 500, 'DRIVER_EXECUTION_CANCEL_FAILED');
  await supabaseAdmin.from('driver_routes').update({ status: 'cancelled', completed_at: completedAt }).eq('id', execution.route_id);
  res.json({ success: true, data });
}));

router.get('/executions/:id/report', asyncHandler(async (req: Request, res: Response) => {
  const execution = await ownedExecution(req.params['id']!, ownerId(req), req.user?.role === 'admin');
  const optimized = execution.planned_snapshot['optimizedResult'] as Record<string, unknown> | undefined;
  const summary = optimized?.['summary'] as Record<string, unknown> | undefined;
  const stopAnalysis = execution.stop_progress.map(stop => {
    const planned = stop.plannedArrival ? new Date(stop.plannedArrival).getTime() : Number.NaN;
    const actual = stop.arrivedAt ? new Date(stop.arrivedAt).getTime() : Number.NaN;
    const arrivalVarianceMinutes = Number.isFinite(planned) && Number.isFinite(actual) ? Math.round((actual - planned) / 60_000) : null;
    return { ...stop, arrivalVarianceMinutes, onTime: arrivalVarianceMinutes === null ? null : arrivalVarianceMinutes <= 5 };
  });
  const actualDurationMinutes = execution.started_at && execution.completed_at
    ? Math.round((new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()) / 60_000)
    : null;
  res.json({ success: true, data: {
    executionId: execution.id,
    status: execution.status,
    plannedDistanceMiles: Number(summary?.['totalDistance'] ?? 0),
    actualDistanceMiles: execution.actual_distance_miles,
    plannedDurationMinutes: Number(summary?.['totalDuration'] ?? 0),
    actualDurationMinutes,
    completedStops: stopAnalysis.filter(stop => stop.status === 'completed').length,
    skippedStops: stopAnalysis.filter(stop => stop.status === 'skipped').length,
    stopAnalysis,
  } });
}));

router.post('/routes/:id/shares', asyncHandler(async (req: Request, res: Response) => {
  const route = await ownedRoute(req.params['id']!, ownerId(req), req.user?.role === 'admin');
  const permission = req.body.permission ?? 'track';
  if (permission !== 'view' && permission !== 'track') throw createError('Share permission must be view or track', 400, 'INVALID_INPUT');
  const { data, error } = await supabaseAdmin
    .from('driver_route_shares')
    .insert({ route_id: route.id, driver_id: route.driver_id, permission, expires_at: optionalIsoDate(req.body.expiresAt, 'Expiration') })
    .select('id, token, permission, expires_at, created_at')
    .single();
  if (error) throw createError(error.message, 500, 'DRIVER_SHARE_CREATE_FAILED');
  res.status(201).json({ success: true, data });
}));

router.get('/routes/:id/export', asyncHandler(async (req: Request, res: Response) => {
  const route = await ownedRoute(req.params['id']!, ownerId(req), req.user?.role === 'admin');
  if (req.query['format'] !== 'csv') {
    res.setHeader('Content-Disposition', `attachment; filename="${route.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-v${route.current_version}.json"`);
    res.json({ route: routeSnapshot(route), status: route.status, version: route.current_version });
    return;
  }
  const rows = ['order,shipment_id,name,address,type,service_minutes,planned_arrival'];
  plannedStops(route).forEach(stop => rows.push([
    stop.order, stop.shipmentId, stop.name, stop.address, stop.type, stop.plannedServiceMinutes, stop.plannedArrival,
  ].map(csvCell).join(',')));
  res.type('text/csv').setHeader('Content-Disposition', `attachment; filename="${route.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-v${route.current_version}.csv"`);
  res.send(rows.join('\r\n'));
}));

router.delete('/routes/:id', asyncHandler(async (req: Request, res: Response) => {
  const route = await ownedRoute(req.params['id']!, ownerId(req), req.user?.role === 'admin');
  if (route.status === 'dispatched' || route.status === 'in_progress') throw createError('Active routes cannot be deleted', 409, 'ACTIVE_ROUTE');
  const { error } = await supabaseAdmin.from('driver_routes').delete().eq('id', route.id);
  if (error) throw createError(error.message, 500, 'DRIVER_ROUTE_DELETE_FAILED');
  res.status(204).send();
}));

export default router;
