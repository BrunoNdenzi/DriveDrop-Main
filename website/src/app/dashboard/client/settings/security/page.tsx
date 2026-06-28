'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

export default function SecuritySettingsPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setLoading(true)
    try {
      // Re-authenticate with current password first
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('Not authenticated')

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInError) throw new Error('Current password is incorrect.')

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || 'Failed to change password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Security</h1>
          <p className="text-xs text-gray-500">Manage your password and account security</p>
        </div>
      </div>

      {success ? (
        <div className="bg-green-50 border border-green-200 rounded-md p-5 text-center space-y-2">
          <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
          <p className="font-semibold text-green-800">Password updated successfully!</p>
          <Button variant="outline" size="sm" onClick={() => setSuccess(false)}>Change Again</Button>
        </div>
      ) : (
        <div className="bg-white rounded-md border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Change Password</h3>
            <button
              type="button"
              onClick={() => setShowPasswords(p => !p)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <Input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>

          <p className="text-xs text-gray-500 mt-4 text-center">
            Forgot your password?{' '}
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              className="text-blue-500 underline"
            >
              Reset via email
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
