'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { 
  Bell,
  Lock,
  Eye,
  Mail,
  Shield,
  HelpCircle,
  FileText,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

export default function ClientSettingsPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const settingsSections = [
    {
      title: 'Account',
      items: [
        {
          icon: Bell,
          label: 'Notifications',
          description: 'Manage email and push notifications',
          href: '/dashboard/client/settings/notifications',
        },
        {
          icon: Eye,
          label: 'Privacy',
          description: 'Control your privacy and data',
          href: '/dashboard/client/settings/privacy',
        },
        {
          icon: Lock,
          label: 'Security',
          description: 'Password and security settings',
          href: '/dashboard/client/settings/security',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: HelpCircle,
          label: 'Help Center',
          description: 'Get help and support',
          href: '/help',
        },
        {
          icon: FileText,
          label: 'Terms & Conditions',
          description: 'Review our terms of service',
          href: '/terms',
        },
        {
          icon: Shield,
          label: 'Privacy Policy',
          description: 'Read our privacy policy',
          href: '/privacy',
        },
      ],
    },
  ]

  return (
    <div className="space-y-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-500">Manage your account settings and preferences</p>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-md border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
              <span className="text-sm font-bold text-blue-500">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {profile?.first_name} {profile?.last_name}
              </h2>
              <p className="text-gray-600">{profile?.email}</p>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        {settingsSections.map((section) => (
          <div key={section.title} className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">{section.title}</h3>
            <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-200">
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.label}
                    onClick={() => router.push(item.href)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
                        <Icon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{item.label}</p>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Sign Out */}
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full text-red-600 border-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* App Version */}
        <div className="text-center mt-4 text-sm text-gray-500">
          DriveDrop Web v1.0.0
        </div>
    </div>
  )
}
