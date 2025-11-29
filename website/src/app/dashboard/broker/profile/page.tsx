'use client';

import { User } from 'lucide-react';

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
        <p className="text-blue-100">
          Manage your broker profile and company information
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <User className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Profile page coming soon
        </h3>
        <p className="text-gray-600">
          Edit your broker profile and company details
        </p>
      </div>
    </div>
  );
}
