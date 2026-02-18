'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your admin preferences and configurations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings Coming Soon</CardTitle>
          <CardDescription>
            This page is under development. Check back later for admin settings and configurations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Future settings will include email preferences, notification settings, and system configurations.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
