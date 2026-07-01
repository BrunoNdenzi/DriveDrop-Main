import { createClient } from '@supabase/supabase-js'

export type AdminNotificationType =
  | 'new_shipment'
  | 'driver_application'
  | 'payment_failed'
  | 'support_ticket'
  | 'deletion_request'
  | 'email_failure'
  | 'assignment_update'
  | 'dispute'
  | 'system'

export type AdminNotificationSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface CreateAdminNotificationParams {
  type: AdminNotificationType
  title: string
  message: string
  severity?: AdminNotificationSeverity
  actionLink?: string
  data?: Record<string, unknown>
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * Insert a new admin notification.
 * Safe to call from any server-side API route or server action.
 * Silently ignores errors to avoid disrupting the calling operation.
 */
export async function createAdminNotification(params: CreateAdminNotificationParams) {
  try {
    const db = getServiceClient()
    if (!db) return
    await db.from('admin_notifications').insert({
      type: params.type,
      title: params.title,
      message: params.message,
      severity: params.severity ?? 'medium',
      action_link: params.actionLink ?? null,
      data: params.data ?? {},
    })
  } catch (err) {
    console.warn('[admin-notify] Failed to create admin notification:', err)
  }
}
