'use client';

import React, { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

interface CommercialAccount {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  account_type: 'broker' | 'auction_house' | 'dealership' | 'fleet_manager' | 'other';
  verification_status: 'pending' | 'verified' | 'rejected';
  monthly_volume_estimate: number;
  created_at: string;
}

export default function CommercialAccountsPage() {
  const [accounts, setAccounts] = useState<CommercialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    loadAccounts();
  }, [filter]);

  async function loadAccounts() {
    try {
      setLoading(true);
      let query = supabase
        .from('commercial_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('verification_status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading commercial accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(accountId: string, status: 'verified' | 'rejected') {
    try {
      const { error } = await supabase
        .from('commercial_accounts')
        .update({ 
          verification_status: status,
          verified_at: status === 'verified' ? new Date().toISOString() : null
        })
        .eq('id', accountId);

      if (error) throw error;
      
      // Reload accounts
      await loadAccounts();
      alert(`Account ${status === 'verified' ? 'approved' : 'rejected'} successfully!`);
    } catch (error) {
      console.error('Error updating account status:', error);
      alert('Failed to update account status');
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'broker': return 'Broker';
      case 'auction_house': return 'Auction House';
      case 'dealership': return 'Dealership';
      case 'fleet_manager': return 'Fleet Manager';
      default: return 'Other';
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Commercial Accounts</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md ${filter === 'all' ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}
          >
            All ({accounts.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-md ${filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`px-4 py-2 rounded-md ${filter === 'verified' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
          >
            Verified
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded-md ${filter === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
          >
            Rejected
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <p className="mt-4 text-gray-600">Loading accounts...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-md">
          <p className="text-gray-500">No commercial accounts found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <div key={account.id} className="bg-white rounded-md p-4 border border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-sm font-semibold">{account.company_name}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(account.verification_status)}`}>
                      {account.verification_status.toUpperCase()}
                    </span>
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                      {getAccountTypeLabel(account.account_type)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-gray-600">Contact:</span>
                      <p className="font-medium">{account.contact_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <p className="font-medium">{account.contact_email}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Phone:</span>
                      <p className="font-medium">{account.contact_phone || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Monthly Volume:</span>
                      <p className="font-medium">{account.monthly_volume_estimate} shipments/month</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Created:</span>
                      <p className="font-medium">{new Date(account.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {account.verification_status === 'pending' && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => updateStatus(account.id, 'verified')}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateStatus(account.id, 'rejected')}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
