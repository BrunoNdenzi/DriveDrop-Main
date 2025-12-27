'use client';

import React, { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

interface Integration {
  id: string;
  commercial_account_id: string;
  integration_name: string;
  integration_type: 'api' | 'sftp' | 'email' | 'csv' | 'webhook';
  status: 'active' | 'inactive' | 'error';
  last_sync_at: string | null;
  sync_frequency: string;
  health_status: {
    status: 'healthy' | 'warning' | 'error';
    last_check: string;
    error_count: number;
  };
  created_at: string;
  commercial_account?: {
    company_name: string;
  };
}

interface IntegrationLog {
  id: string;
  integration_id: string;
  log_type: 'sync' | 'error' | 'config_change';
  message: string;
  created_at: string;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    loadIntegrations();
  }, []);

  useEffect(() => {
    if (selectedIntegration) {
      loadLogs(selectedIntegration);
    }
  }, [selectedIntegration]);

  async function loadIntegrations() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('auction_integrations')
        .select(`
          *,
          commercial_account:commercial_accounts(company_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs(integrationId: string) {
    try {
      const { data, error } = await supabase
        .from('integration_logs')
        .select('*')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  }

  async function testIntegration(integrationId: string) {
    setTesting(integrationId);
    try {
      // Call the backend API endpoint
      const response = await fetch(`/api/integrations/${integrationId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ Integration test successful!\n\nVehicles found: ${result.vehiclesFound}\nConnection: OK`);
      } else {
        alert(`❌ Integration test failed:\n\n${result.message || 'Unknown error'}`);
      }

      // Reload integrations to get updated health status
      await loadIntegrations();
    } catch (error) {
      console.error('Error testing integration:', error);
      alert('Failed to test integration. Check console for details.');
    } finally {
      setTesting(null);
    }
  }

  async function syncIntegration(integrationId: string) {
    try {
      const response = await fetch(`/api/integrations/${integrationId}/sync`, {
        method: 'POST',
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ Sync started!\n\nJob ID: ${result.message}`);
        await loadIntegrations();
      } else {
        alert(`❌ Sync failed:\n\n${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error syncing integration:', error);
      alert('Failed to start sync. Check console for details.');
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'api': return '🔌';
      case 'sftp': return '📁';
      case 'email': return '📧';
      case 'csv': return '📊';
      case 'webhook': return '🔗';
      default: return '📦';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Integration Management</h1>
        <button
          onClick={loadIntegrations}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading integrations...</p>
        </div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No integrations configured yet</p>
          <p className="text-sm text-gray-400 mt-2">Commercial accounts can set up integrations via API</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Integrations List */}
          <div className="space-y-4">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className={`bg-white rounded-lg shadow-md p-5 border-2 cursor-pointer transition ${
                  selectedIntegration === integration.id ? 'border-blue-500' : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedIntegration(integration.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getTypeIcon(integration.integration_type)}</span>
                    <div>
                      <h3 className="font-bold text-lg">{integration.integration_name}</h3>
                      <p className="text-sm text-gray-600">
                        {integration.commercial_account?.company_name || 'Unknown Account'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(integration.status)}`}>
                    {integration.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <p className="font-medium capitalize">{integration.integration_type}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Sync Frequency:</span>
                    <p className="font-medium">{integration.sync_frequency}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Last Sync:</span>
                    <p className="font-medium">
                      {integration.last_sync_at
                        ? new Date(integration.last_sync_at).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Health:</span>
                    <p className={`font-bold ${getHealthColor(integration.health_status?.status || 'unknown')}`}>
                      {integration.health_status?.status?.toUpperCase() || 'UNKNOWN'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      testIntegration(integration.id);
                    }}
                    disabled={testing === integration.id}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm"
                  >
                    {testing === integration.id ? '⏳ Testing...' : '🧪 Test'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      syncIntegration(integration.id);
                    }}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                  >
                    ▶️ Sync Now
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Logs Panel */}
          <div className="bg-white rounded-lg shadow-md p-5 border border-gray-200 h-fit sticky top-6">
            <h2 className="text-xl font-bold mb-4">Integration Logs</h2>
            {selectedIntegration ? (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No logs available</p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg text-sm ${
                        log.log_type === 'error'
                          ? 'bg-red-50 border border-red-200'
                          : log.log_type === 'sync'
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold capitalize">{log.log_type}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-700">{log.message}</p>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Select an integration to view logs</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
