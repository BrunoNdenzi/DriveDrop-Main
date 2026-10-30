import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServiceSupabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { requestAdmin } from '@/lib/server-auth'

const PROOF_BUCKET = 'planner-proof'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Storage = ReturnType<typeof getServiceSupabase>['storage']

// Proof photos and signatures sit in <user>/<run>/<stop>/<file>, so walk the folders before removing.
async function removeFolder(storage: Storage, prefix: string): Promise<void> {
  const files: string[] = []
  const walk = async (folder: string): Promise<void> => {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await storage.from(PROOF_BUCKET).list(folder, { limit: 100, offset })
      if (error) throw error
      if (!data?.length) return
      for (const entry of data) {
        const path = `${folder}/${entry.name}`
        if (entry.id) files.push(path)
        else await walk(path)
      }
      if (data.length < 100) return
    }
  }
  await walk(prefix)
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await storage.from(PROOF_BUCKET).remove(files.slice(i, i + 100))
    if (error) throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requestAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

    const { userId } = await request.json().catch(() => ({})) as { userId?: unknown }
    if (typeof userId !== 'string' || !UUID.test(userId)) {
      return NextResponse.json({ error: 'A valid userId is required' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const { data: target, error: lookupError } = await supabase.auth.admin.getUserById(userId)
    if (lookupError || !target.user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const email = target.user.email

    // A paid planner subscription must stop before the account disappears, or billing carries on with nobody to cancel it.
    const { data: subscription } = await supabase.from('planner_subscriptions').select('stripe_subscription_id').eq('user_id', userId).maybeSingle()
    if (subscription?.stripe_subscription_id) {
      if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Stripe is not configured, so the subscription cannot be cancelled' }, { status: 502 })
      try {
        await new Stripe(process.env.STRIPE_SECRET_KEY).subscriptions.cancel(subscription.stripe_subscription_id)
      } catch (error) {
        if ((error as { code?: string }).code !== 'resource_missing') {
          console.error('Subscription cancel failed:', error)
          return NextResponse.json({ error: 'Could not cancel the subscription. Nothing was deleted; try again.' }, { status: 502 })
        }
      }
    }

    try {
      await removeFolder(supabase.storage, userId)
    } catch (error) {
      // A project that never stored proof has no bucket; that is not a failure.
      if (!/not found/i.test((error as { message?: string }).message ?? '')) {
        console.error('Proof file removal failed:', error)
        return NextResponse.json({ error: 'Could not remove stored proof files. Nothing was deleted; try again.' }, { status: 502 })
      }
    }

    const { data: planner } = await supabase.from('planner_profiles').select('user_id').eq('user_id', userId).maybeSingle()
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw error

    if (email) {
      const productName = planner ? 'DriveDrop Route Planner' : 'DriveDrop'
      sendEmail({
        to: email,
        subject: `Your ${productName} account has been deleted`,
        html: `
          <h2>Account deletion confirmed</h2>
          <p>Your ${productName} account and the data in it have been permanently deleted as requested${planner ? ', and any subscription has been cancelled' : ''}.</p>
          <p>If you believe this was a mistake, contact us at <a href="mailto:infos@drivedrop.us.com">infos@drivedrop.us.com</a>.</p>
        `,
      }).catch((e) => console.warn('Deletion confirmation email failed:', e))
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Admin delete user error:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
