'use client';

import { User } from 'lucide-react';

export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Profile Settings</h1>
        <p className="text-xs text-gray-500">
          Manage your broker profile and company information
        </p>
      </div>

      <div className="bg-white rounded-md border border-gray-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 rounded-md mb-3">
          <User className="h-5 w-5 text-gray-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          Profile page coming soon
        </h3>
        <p className="text-xs text-gray-500">
          Edit your broker profile and company details
        </p>
      </div>
    </div>
  );
}
