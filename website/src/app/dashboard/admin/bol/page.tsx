'use client';

import React, { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

interface BOL {
  id: string;
  shipment_id: string;
  bol_number: string;
  status: 'draft' | 'issued' | 'in_transit' | 'delivered' | 'cancelled';
  shipper_info: {
    name: string;
    address: string;
    phone: string;
  };
  consignee_info: {
    name: string;
    address: string;
    phone: string;
  };
  vehicle_info: {
    year: number;
    make: string;
    model: string;
    vin: string;
  };
  pickup_signature_url: string | null;
  delivery_signature_url: string | null;
  created_at: string;
  issued_at: string | null;
}

interface VehicleCondition {
  id: string;
  bol_id: string;
  inspection_type: 'pickup' | 'delivery';
  condition_notes: string;
  damage_items: any[];
  photos: string[];
  created_at: string;
}

export default function BOLManagementPage() {
  const [bols, setBOLs] = useState<BOL[]>([]);
  const [selectedBOL, setSelectedBOL] = useState<BOL | null>(null);
  const [conditions, setConditions] = useState<VehicleCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    loadBOLs();
  }, [filter]);

  useEffect(() => {
    if (selectedBOL) {
      loadConditions(selectedBOL.id);
    }
  }, [selectedBOL]);

  async function loadBOLs() {
    try {
      setLoading(true);
      let query = supabase
        .from('bills_of_lading')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBOLs(data || []);
    } catch (error) {
      console.error('Error loading BOLs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadConditions(bolId: string) {
    try {
      const { data, error } = await supabase
        .from('vehicle_conditions')
        .select('*')
        .eq('bol_id', bolId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setConditions(data || []);
    } catch (error) {
      console.error('Error loading conditions:', error);
    }
  }

  async function generatePDF(bolId: string) {
    try {
      const response = await fetch(`/api/bol/${bolId}/pdf`, {
        method: 'GET',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BOL-${selectedBOL?.bol_number || bolId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        alert('✅ PDF downloaded!');
      } else {
        alert('❌ Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'issued': return 'bg-blue-100 text-blue-800';
      case 'in_transit': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Bill of Lading Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md ${filter === 'all' ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('issued')}
            className={`px-4 py-2 rounded-md ${filter === 'issued' ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}
          >
            Issued
          </button>
          <button
            onClick={() => setFilter('in_transit')}
            className={`px-4 py-2 rounded-md ${filter === 'in_transit' ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
          >
            In Transit
          </button>
          <button
            onClick={() => setFilter('delivered')}
            className={`px-4 py-2 rounded-md ${filter === 'delivered' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
          >
            Delivered
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <p className="mt-4 text-gray-600">Loading BOLs...</p>
        </div>
      ) : bols.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-md">
          <p className="text-gray-500">No Bills of Lading found</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* BOL List */}
          <div className="lg:col-span-1 space-y-3">
            {bols.map((bol) => (
              <div
                key={bol.id}
                className={`bg-white rounded-md p-4 border-2 cursor-pointer transition ${
                  selectedBOL?.id === bol.id ? 'border-purple-500' : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => setSelectedBOL(bol)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold">BOL #{bol.bol_number}</h4>
                    <p className="text-xs text-gray-500">{bol.vehicle_info.year} {bol.vehicle_info.make} {bol.vehicle_info.model}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bol.status)}`}>
                    {bol.status.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-2">VIN: {bol.vehicle_info.vin}</p>
                <p className="text-xs text-gray-500">{new Date(bol.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>

          {/* BOL Details */}
          <div className="lg:col-span-2">
            {selectedBOL ? (
              <div className="bg-white rounded-md border p-4 border-gray-200 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold">BOL #{selectedBOL.bol_number}</h2>
                    <p className="text-gray-600">{selectedBOL.vehicle_info.year} {selectedBOL.vehicle_info.make} {selectedBOL.vehicle_info.model}</p>
                  </div>
                  <span className={`px-4 py-2 rounded-full text-sm font-bold ${getStatusColor(selectedBOL.status)}`}>
                    {selectedBOL.status.toUpperCase().replace('_', ' ')}
                  </span>
                </div>

                {/* Vehicle Info */}
                <div className="border rounded-md p-4 bg-gray-50">
                  <h3 className="font-bold mb-3">Vehicle Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">VIN:</span>
                      <p className="font-mono font-bold">{selectedBOL.vehicle_info.vin}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Vehicle:</span>
                      <p className="font-bold">{selectedBOL.vehicle_info.year} {selectedBOL.vehicle_info.make} {selectedBOL.vehicle_info.model}</p>
                    </div>
                  </div>
                </div>

                {/* Shipper & Consignee */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded-md p-4 bg-blue-50">
                    <h3 className="font-bold mb-2">Shipper</h3>
                    <p className="font-bold">{selectedBOL.shipper_info.name}</p>
                    <p className="text-sm text-gray-600">{selectedBOL.shipper_info.address}</p>
                    <p className="text-sm text-gray-600">{selectedBOL.shipper_info.phone}</p>
                  </div>
                  <div className="border rounded-md p-4 bg-green-50">
                    <h3 className="font-bold mb-2">Consignee</h3>
                    <p className="font-bold">{selectedBOL.consignee_info.name}</p>
                    <p className="text-sm text-gray-600">{selectedBOL.consignee_info.address}</p>
                    <p className="text-sm text-gray-600">{selectedBOL.consignee_info.phone}</p>
                  </div>
                </div>

                {/* Vehicle Condition Reports */}
                <div className="border rounded-md p-4 bg-gray-50">
                  <h3 className="font-bold mb-3">Vehicle Condition Reports</h3>
                  {conditions.length > 0 ? (
                    <div className="space-y-3">
                      {conditions.map((condition) => (
                        <div key={condition.id} className="p-3 bg-white rounded border">
                          <div className="flex justify-between items-start mb-2">
                            <span className={`font-bold ${condition.inspection_type === 'pickup' ? 'text-blue-600' : 'text-green-600'}`}>
                              {condition.inspection_type === 'pickup' ? '📤 Pickup' : '📥 Delivery'} Inspection
                            </span>
                            <span className="text-xs text-gray-500">{new Date(condition.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-gray-700">{condition.condition_notes}</p>
                          {condition.damage_items.length > 0 && (
                            <div className="mt-2 p-2 bg-red-50 rounded text-sm">
                              <span className="font-bold text-red-800">⚠️ Damage Reported:</span>
                              <ul className="list-disc list-inside text-red-700">
                                {condition.damage_items.map((item: any, idx: number) => (
                                  <li key={idx}>{item.description}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No condition reports yet</p>
                  )}
                </div>

                {/* Signatures */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded-md p-4 bg-gray-50">
                    <h3 className="font-bold mb-2">Pickup Signature</h3>
                    {selectedBOL.pickup_signature_url ? (
                      <img src={selectedBOL.pickup_signature_url} alt="Pickup Signature" className="border rounded max-h-32" />
                    ) : (
                      <p className="text-gray-500 text-sm">Not signed yet</p>
                    )}
                  </div>
                  <div className="border rounded-md p-4 bg-gray-50">
                    <h3 className="font-bold mb-2">Delivery Signature</h3>
                    {selectedBOL.delivery_signature_url ? (
                      <img src={selectedBOL.delivery_signature_url} alt="Delivery Signature" className="border rounded max-h-32" />
                    ) : (
                      <p className="text-gray-500 text-sm">Not signed yet</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => generatePDF(selectedBOL.id)}
                  className="w-full px-6 py-3 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition font-bold"
                >
                  📄 Download PDF
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-md border p-4 border-gray-200 text-center">
                <p className="text-gray-500">Select a BOL to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
