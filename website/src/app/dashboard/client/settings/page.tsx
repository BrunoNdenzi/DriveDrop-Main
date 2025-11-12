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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-teal-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-teal-600">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {profile?.first_name} {profile?.last_name}
              </h2>
              <p className="text-gray-600">{profile?.email}</p>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        {settingsSections.map((section) => (
          <div key={section.title} className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{section.title}</h3>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.label}
                    onClick={() => router.push(item.href)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
        <div className="text-center mt-8 text-sm text-gray-500">
          DriveDrop Web v1.0.0
        </div>
      </div>
    </div>
  )
}
