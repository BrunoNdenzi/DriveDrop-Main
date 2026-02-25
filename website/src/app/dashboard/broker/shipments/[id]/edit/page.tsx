'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EditBrokerShipmentPage() {
  const router = useRouter();
  const params = useParams();
  const shipmentId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    pickup_address: '',
    pickup_city: '',
    pickup_state: '',
    pickup_zip: '',
    delivery_address: '',
    delivery_city: '',
    delivery_state: '',
    delivery_zip: '',
    vehicle_year: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_type: 'sedan',
    vehicle_condition: 'running',
    estimated_price: '',
    pickup_date: '',
    delivery_date: '',
    notes: '',
  });

  useEffect(() => {
    fetchShipment();
  }, [shipmentId]);

  const fetchShipment = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data, error: err } = await supabase
        .from('broker_shipments')
        .select('*')
        .eq('id', shipmentId)
        .eq('broker_id', user.id)
        .single();

      if (err) throw err;
      setForm({
        client_name: data.client_name || '',
        client_email: data.client_email || '',
        client_phone: data.client_phone || '',
        pickup_address: data.pickup_address || '',
        pickup_city: data.pickup_city || '',
        pickup_state: data.pickup_state || '',
        pickup_zip: data.pickup_zip || '',
        delivery_address: data.delivery_address || '',
        delivery_city: data.delivery_city || '',
        delivery_state: data.delivery_state || '',
        delivery_zip: data.delivery_zip || '',
        vehicle_year: String(data.vehicle_year || ''),
        vehicle_make: data.vehicle_make || '',
        vehicle_model: data.vehicle_model || '',
        vehicle_type: data.vehicle_type || 'sedan',
        vehicle_condition: data.vehicle_condition || 'running',
        estimated_price: String(data.estimated_price || ''),
        pickup_date: data.pickup_date?.split('T')[0] || '',
        delivery_date: data.delivery_date?.split('T')[0] || '',
        notes: data.notes || '',
      });
    } catch (err: any) {
      setError(err.message || 'Shipment not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: err } = await supabase
        .from('broker_shipments')
        .update({
          ...form,
          vehicle_year: parseInt(form.vehicle_year) || 0,
          estimated_price: parseFloat(form.estimated_price) || 0,
          pickup_date: form.pickup_date || null,
          delivery_date: form.delivery_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipmentId);

      if (err) throw err;
      setSuccess('Shipment updated successfully');
      setTimeout(() => router.push(`/dashboard/broker/shipments/${shipmentId}`), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /></div>;
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-lg font-semibold text-gray-900">Edit Shipment</h1>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md text-sm">{success}</div>}

      <div className="bg-white rounded-md border border-gray-200 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Client Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Client Name *</label>
            <input type="text" value={form.client_name} onChange={(e) => updateField('client_name', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" value={form.client_email} onChange={(e) => updateField('client_email', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={form.client_phone} onChange={(e) => updateField('client_phone', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Pickup Location</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">Address *</label><input type="text" value={form.pickup_address} onChange={(e) => updateField('pickup_address', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">City</label><input type="text" value={form.pickup_city} onChange={(e) => updateField('pickup_city', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">State</label><input type="text" value={form.pickup_state} onChange={(e) => updateField('pickup_state', e.target.value)} maxLength={2} className="w-full px-3 py-2 border rounded-md text-sm uppercase" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">ZIP</label><input type="text" value={form.pickup_zip} onChange={(e) => updateField('pickup_zip', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" /></div>
          </div>
        </div>
        <div><label className="block text-xs font-medium text-gray-700 mb-1">Pickup Date</label><input type="date" value={form.pickup_date} onChange={(e) => updateField('pickup_date', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" /></div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Delivery Location</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-700 mb-1">Address *</label><input type="text" value={form.delivery_address} onChange={(e) => updateField('delivery_address', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">City</label><input type="text" value={form.delivery_city} onChange={(e) => updateField('delivery_city', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">State</label><input type="text" value={form.delivery_state} onChange={(e) => updateField('delivery_state', e.target.value)} maxLength={2} className="w-full px-3 py-2 border rounded-md text-sm uppercase" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">ZIP</label><input type="text" value={form.delivery_zip} onChange={(e) => updateField('delivery_zip', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" /></div>
          </div>
        </div>
        <div><label className="block text-xs font-medium text-gray-700 mb-1">Delivery Date</label><input type="date" value={form.delivery_date} onChange={(e) => updateField('delivery_date', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" /></div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Vehicle Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Year</label><input type="number" value={form.vehicle_year} onChange={(e) => updateField('vehicle_year', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Make</label><input type="text" value={form.vehicle_make} onChange={(e) => updateField('vehicle_make', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Model</label><input type="text" value={form.vehicle_model} onChange={(e) => updateField('vehicle_model', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select value={form.vehicle_type} onChange={(e) => updateField('vehicle_type', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm">
              <option value="sedan">Sedan</option><option value="suv">SUV</option><option value="truck">Truck</option><option value="van">Van</option><option value="motorcycle">Motorcycle</option><option value="classic">Classic</option><option value="luxury">Luxury</option><option value="electric">Electric</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Condition</label>
            <select value={form.vehicle_condition} onChange={(e) => updateField('vehicle_condition', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm">
              <option value="running">Running</option><option value="non_running">Non-Running</option><option value="damaged">Damaged</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Price ($)</label>
            <input type="number" value={form.estimated_price} onChange={(e) => updateField('estimated_price', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Notes</h2>
        <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Any special instructions..." />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="bg-teal-500 hover:bg-teal-600">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save Changes</>}
        </Button>
      </div>
    </div>
  );
}
