'use client';

import { Package } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Documents</h1>
        <p className="text-blue-100">
          Manage your verification documents and compliance files
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <Package className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Documents page coming soon
        </h3>
        <p className="text-gray-600">
          Upload and manage your verification documents
        </p>
      </div>
    </div>
  );
}
