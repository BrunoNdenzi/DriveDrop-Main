import { getServiceSupabase } from '@/lib/supabase'

export interface RequestUser {
  id: string
  email: string | null
}

// The signed-in user behind a "Authorization: Bearer <token>" header, checked with Supabase; null when missing or invalid.
export async function requestUser(request: Request): Promise<RequestUser | null> {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]
  if (!token) return null
  const { data, error } = await getServiceSupabase().auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? null }
}

export async function requestAdmin(request: Request): Promise<RequestUser | null> {
  const user = await requestUser(request)
  if (!user) return null
  const { data } = await getServiceSupabase().from('profiles').select('role').eq('id', user.id).maybeSingle()
  return data?.role === 'admin' ? user : null
}

export const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
