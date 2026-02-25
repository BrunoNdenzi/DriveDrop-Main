'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { 
  ArrowLeft, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Loader2,
  Edit2,
  Save,
  Trash2,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  Users,
  Globe,
  Clock,
  ArrowRightLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BenjiChat } from '@/components/benji/BenjiChat';
import { useAuth } from '@/hooks/useAuth';

// Required fields configuration
const REQUIRED_FIELDS = [
  'client_name', 'client_email', 'client_phone',
  'pickup_address', 'pickup_city', 'pickup_state', 'pickup_zip',
  'delivery_address', 'delivery_city', 'delivery_state', 'delivery_zip',
  'vehicle_year', 'vehicle_make', 'vehicle_model', 'vehicle_type',
  'estimated_price'
];

const OPTIONAL_FIELDS = [
  'vehicle_condition', 'vehicle_vin', 'distance_miles',
  'pickup_date', 'delivery_date', 'transport_type', 'is_operable', 'notes'
];

// Field labels for display
const FIELD_LABELS: Record<string, string> = {
  client_name: 'Client Name',
  client_email: 'Client Email',
  client_phone: 'Client Phone',
  pickup_address: 'Pickup Address',
  pickup_city: 'Pickup City',
  pickup_state: 'Pickup State',
  pickup_zip: 'Pickup ZIP',
  delivery_address: 'Delivery Address',
  delivery_city: 'Delivery City',
  delivery_state: 'Delivery State',
  delivery_zip: 'Delivery ZIP',
  vehicle_year: 'Vehicle Year',
  vehicle_make: 'Vehicle Make',
  vehicle_model: 'Vehicle Model',
  vehicle_type: 'Vehicle Type',
  vehicle_condition: 'Condition',
  vehicle_vin: 'VIN',
  estimated_price: 'Price',
  distance_miles: 'Distance',
  pickup_date: 'Pickup Date',
  delivery_date: 'Delivery Date',
  transport_type: 'Transport',
  is_operable: 'Operable',
  notes: 'Notes',
};

interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
  status: 'valid' | 'error' | 'warning' | 'uploaded' | 'editing';
  uploadError?: string;
}

type UploadPhase = 'select' | 'review' | 'uploading' | 'results';
type AssignmentStrategy = 'load_board_public' | 'load_board_network' | 'pending_manual';

export default function BulkUploadPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('select');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [assignmentStrategy, setAssignmentStrategy] = useState<AssignmentStrategy>('load_board_network');
  const [uploadedShipmentIds, setUploadedShipmentIds] = useState<string[]>([]);
  const [loadBoardCount, setLoadBoardCount] = useState(0);

  // Validate a single row
  const validateRow = useCallback((data: Record<string, string>, rowIndex: number): ParsedRow => {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (!data[field]?.trim()) {
        errors.push({ field, message: `${FIELD_LABELS[field] || field} is required` });
      }
    }

    // Validate email format
    if (data.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.client_email)) {
      errors.push({ field: 'client_email', message: 'Invalid email format' });
    }

    // Validate year
    const year = parseInt(data.vehicle_year);
    if (data.vehicle_year && (isNaN(year) || year < 1900 || year > 2030)) {
      errors.push({ field: 'vehicle_year', message: 'Year must be between 1900-2030' });
    }

    // Validate price
    const price = parseFloat(data.estimated_price);
    if (data.estimated_price && (isNaN(price) || price <= 0)) {
      errors.push({ field: 'estimated_price', message: 'Price must be a positive number' });
    } else if (price > 0 && price < 100) {
      warnings.push({ field: 'estimated_price', message: 'Price seems unusually low' });
    }

    // Validate state abbreviation
    if (data.pickup_state && data.pickup_state.length !== 2) {
      warnings.push({ field: 'pickup_state', message: 'Use 2-letter state code (e.g., NC)' });
    }
    if (data.delivery_state && data.delivery_state.length !== 2) {
      warnings.push({ field: 'delivery_state', message: 'Use 2-letter state code (e.g., NC)' });
    }

    // Validate dates
    if (data.pickup_date && isNaN(Date.parse(data.pickup_date))) {
      errors.push({ field: 'pickup_date', message: 'Invalid date format (use YYYY-MM-DD)' });
    }
    if (data.delivery_date && isNaN(Date.parse(data.delivery_date))) {
      errors.push({ field: 'delivery_date', message: 'Invalid date format (use YYYY-MM-DD)' });
    }

    // Validate VIN length
    if (data.vehicle_vin && data.vehicle_vin.length !== 17 && data.vehicle_vin.length > 0) {
      warnings.push({ field: 'vehicle_vin', message: 'VIN should be exactly 17 characters' });
    }

    return {
      rowIndex,
      data,
      errors,
      warnings,
      status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid',
    };
  }, []);

  // Parse CSV file
  const parseCSV = useCallback(async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      alert('CSV file must have a header row and at least one data row');
      return;
    }

    const csvHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    setHeaders(csvHeaders);

    // Check for required headers
    const missingHeaders = REQUIRED_FIELDS.filter(f => !csvHeaders.includes(f));
    if (missingHeaders.length > 0) {
      alert(`Missing required columns: ${missingHeaders.map(h => FIELD_LABELS[h] || h).join(', ')}\n\nPlease download the template to see the correct format.`);
      return;
    }

    // Parse data rows with smart CSV parsing (handles commas in quoted fields)
    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const rowData: Record<string, string> = {};
      csvHeaders.forEach((header, idx) => {
        rowData[header] = values[idx] || '';
      });

      rows.push(validateRow(rowData, i));
    }

    setParsedRows(rows);
    setPhase('review');
  }, [validateRow]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        alert('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setParsedRows([]);
      setPhase('select');
      parseCSV(selectedFile);
    }
  };

  // Start editing a row
  const startEdit = (rowIndex: number) => {
    const row = parsedRows.find(r => r.rowIndex === rowIndex);
    if (!row) return;
    setEditingRow(rowIndex);
    setEditData({ ...row.data });
  };

  // Save edit and re-validate
  const saveEdit = () => {
    if (editingRow === null) return;
    
    const updatedRows = parsedRows.map(row => {
      if (row.rowIndex === editingRow) {
        return validateRow(editData, row.rowIndex);
      }
      return row;
    });
    
    setParsedRows(updatedRows);
    setEditingRow(null);
    setEditData({});
  };

  // Remove a row
  const removeRow = (rowIndex: number) => {
    setParsedRows(prev => prev.filter(r => r.rowIndex !== rowIndex));
  };

  // Upload all valid rows
  const handleUpload = async () => {
    const validRows = parsedRows.filter(r => r.status === 'valid' || r.status === 'warning');
    if (validRows.length === 0) {
      alert('No valid rows to upload. Please fix the errors first.');
      return;
    }

    setUploading(true);
    setPhase('uploading');
    setUploadProgress(0);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: brokerProfile } = await supabase
        .from('broker_profiles')
        .select('default_commission_rate')
        .eq('profile_id', user.id)
        .single();

      const commissionRate = brokerProfile?.default_commission_rate || 15;
      const platformFeeRate = 10; // 10% platform fee
      const updatedRows = [...parsedRows];
      const newShipmentIds: string[] = [];
      let boardCount = 0;

      // Determine initial status based on assignment strategy
      const initialStatus = assignmentStrategy === 'pending_manual' ? 'pending_quote' : 'quoted';

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const data = row.data;

        try {
          const totalPrice = parseFloat(data.estimated_price);
          const brokerCommission = (totalPrice * commissionRate) / 100;
          const platformFee = (totalPrice * platformFeeRate) / 100;

          // 1) Create the broker shipment
          const { data: shipmentData, error } = await supabase
            .from('broker_shipments')
            .insert({
              broker_id: user.id,
              client_name: data.client_name,
              client_email: data.client_email,
              client_phone: data.client_phone,
              pickup_address: data.pickup_address,
              pickup_city: data.pickup_city,
              pickup_state: data.pickup_state,
              pickup_zip: data.pickup_zip,
              delivery_address: data.delivery_address,
              delivery_city: data.delivery_city,
              delivery_state: data.delivery_state,
              delivery_zip: data.delivery_zip,
              vehicle_year: parseInt(data.vehicle_year),
              vehicle_make: data.vehicle_make,
              vehicle_model: data.vehicle_model,
              vehicle_type: data.vehicle_type,
              vehicle_condition: data.vehicle_condition || 'running',
              vehicle_vin: data.vehicle_vin || null,
              distance_miles: parseFloat(data.distance_miles || '0'),
              estimated_price: totalPrice,
              broker_commission: brokerCommission,
              platform_fee: platformFee,
              pickup_date: data.pickup_date || null,
              delivery_date: data.delivery_date || null,
              transport_type: data.transport_type || 'open',
              is_operable: data.is_operable !== 'false',
              notes: data.notes || null,
              status: initialStatus,
              metadata: { assignment_strategy: assignmentStrategy, bulk_upload: true },
            })
            .select('id')
            .single();

          if (error) throw error;

          // Track the created shipment ID
          if (shipmentData?.id) {
            newShipmentIds.push(shipmentData.id);

            // 2) If assignment strategy involves load board, create load board entry
            if (assignmentStrategy !== 'pending_manual') {
              const visibility = assignmentStrategy === 'load_board_network' ? 'network_only' : 'public';
              const carrierPayout = totalPrice - brokerCommission - platformFee;

              // We store shipment_id as the broker_shipment ID for reference
              // The load board links to the main shipments table — first create a shipment mirror
              const { data: mainShipment } = await supabase
                .from('shipments')
                .insert({
                  client_id: user.id,
                  driver_id: null,
                  pickup_address: `${data.pickup_address}, ${data.pickup_city}, ${data.pickup_state} ${data.pickup_zip}`,
                  dropoff_address: `${data.delivery_address}, ${data.delivery_city}, ${data.delivery_state} ${data.delivery_zip}`,
                  vehicle_year: parseInt(data.vehicle_year),
                  vehicle_make: data.vehicle_make,
                  vehicle_model: data.vehicle_model,
                  vehicle_type: data.vehicle_type,
                  vehicle_condition: data.vehicle_condition || 'running',
                  transport_type: data.transport_type || 'open',
                  is_operable: data.is_operable !== 'false',
                  distance: parseFloat(data.distance_miles || '0'),
                  estimated_price: totalPrice,
                  status: 'quoted',
                  special_instructions: data.notes || null,
                })
                .select('id')
                .single();

              if (mainShipment?.id) {
                await supabase.from('load_board').insert({
                  shipment_id: mainShipment.id,
                  posted_by: user.id,
                  visibility,
                  load_status: 'available',
                  bidding_enabled: true,
                  suggested_carrier_payout: carrierPayout,
                  max_broker_commission: brokerCommission,
                  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                });
                boardCount++;

                // Link the load board posting back to the broker shipment
                await supabase
                  .from('broker_shipments')
                  .update({ status: 'quoted' })
                  .eq('id', shipmentData.id);
              }
            }
          }

          const idx = updatedRows.findIndex(r => r.rowIndex === row.rowIndex);
          if (idx !== -1) {
            updatedRows[idx] = { ...updatedRows[idx], status: 'uploaded' };
          }
        } catch (err: any) {
          const idx = updatedRows.findIndex(r => r.rowIndex === row.rowIndex);
          if (idx !== -1) {
            updatedRows[idx] = {
              ...updatedRows[idx],
              status: 'error',
              uploadError: err.message || 'Upload failed',
              errors: [...updatedRows[idx].errors, { field: '_upload', message: err.message || 'Upload failed' }],
            };
          }
        }

        setUploadProgress(Math.round(((i + 1) / validRows.length) * 100));
        setParsedRows([...updatedRows]);
      }

      setParsedRows(updatedRows);
      setUploadedShipmentIds(newShipmentIds);
      setLoadBoardCount(boardCount);
      setPhase('results');
    } catch (err: any) {
      console.error('Upload error:', err);
      alert('Fatal upload error: ' + err.message);
      setPhase('review');
    } finally {
      setUploading(false);
    }
  };

  // Retry failed rows
  const retryFailed = () => {
    const updated = parsedRows.map(row => {
      if (row.status === 'error' && row.uploadError) {
        return validateRow(row.data, row.rowIndex);
      }
      return row;
    });
    setParsedRows(updated);
    setPhase('review');
  };

  // Download template
  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = '/drivedrop_bulk_upload_sample.csv';
    a.download = 'drivedrop_bulk_upload_template.csv';
    a.click();
  };

  // Download errors report
  const downloadErrorReport = () => {
    const errorRows = parsedRows.filter(r => r.status === 'error');
    if (errorRows.length === 0) return;

    let csvContent = headers.join(',') + ',errors\n';
    errorRows.forEach(row => {
      const values = headers.map(h => `"${(row.data[h] || '').replace(/"/g, '""')}"`);
      const errorText = row.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      values.push(`"${errorText}"`);
      csvContent += values.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drivedrop_upload_errors.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Stats
  const stats = {
    total: parsedRows.length,
    valid: parsedRows.filter(r => r.status === 'valid').length,
    warnings: parsedRows.filter(r => r.status === 'warning').length,
    errors: parsedRows.filter(r => r.status === 'error').length,
    uploaded: parsedRows.filter(r => r.status === 'uploaded').length,
  };

  const filteredRows = filterStatus === 'all' 
    ? parsedRows 
    : parsedRows.filter(r => r.status === filterStatus);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/broker/shipments">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Shipments
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Bulk Upload Shipments</h1>
            <p className="text-gray-600 text-sm mt-1">Upload, validate, edit and submit multiple shipments at once</p>
          </div>
        </div>
      </div>

      {/* Phase: Select File */}
      {phase === 'select' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold">1</div>
                <h3 className="font-semibold text-gray-900">Download Template</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Download our CSV template with 10 example rows to see the exact format
              </p>
              <Button onClick={downloadTemplate} variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
                <Download className="h-4 w-4 mr-2" />
                Download Sample CSV
              </Button>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-600 rounded-md flex items-center justify-center text-white font-bold">2</div>
                <h3 className="font-semibold text-gray-900">Review & Fix Errors</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                After uploading, review each row. Fix errors inline without re-uploading the entire file
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-600 rounded-md flex items-center justify-center text-white font-bold">3</div>
                <h3 className="font-semibold text-gray-900">Submit Valid Rows</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Submit all valid rows. Failed rows stay for correction — retry without re-uploading
              </p>
            </div>
          </div>

          <div className="bg-white rounded-md border border-gray-200 p-6">
            <div className="max-w-2xl mx-auto">
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 transition-colors"
              >
                <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Click to upload CSV file</h3>
                <p className="text-sm text-gray-500">Supports .csv files up to 5MB</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h3 className="font-semibold text-gray-900 mb-3">CSV Column Reference</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700 mb-2">Client Info <span className="text-red-500">*required</span></p>
                <ul className="text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">client_name</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">client_email</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">client_phone</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">Pickup <span className="text-red-500">*required</span></p>
                <ul className="text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">pickup_address</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">pickup_city</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">pickup_state</code> (2-letter)</li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">pickup_zip</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">Delivery <span className="text-red-500">*required</span></p>
                <ul className="text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">delivery_address</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">delivery_city</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">delivery_state</code> (2-letter)</li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">delivery_zip</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">Vehicle <span className="text-red-500">*required</span></p>
                <ul className="text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">vehicle_year</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">vehicle_make</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">vehicle_model</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">vehicle_type</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">Pricing <span className="text-red-500">*required</span></p>
                <ul className="text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">estimated_price</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-gray-700 mb-2">Optional</p>
                <ul className="text-gray-600 space-y-1">
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">vehicle_vin</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">distance_miles</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">pickup_date</code> (YYYY-MM-DD)</li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">delivery_date</code></li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">transport_type</code> (open/enclosed)</li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">is_operable</code> (true/false)</li>
                  <li>• <code className="bg-gray-200 px-1 rounded text-xs">notes</code></li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Phase: Review & Edit / Results */}
      {(phase === 'review' || phase === 'results') && (
        <>
          {/* File Info & Stats */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">{file?.name}</p>
                  <p className="text-xs text-gray-500">{stats.total} rows parsed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {phase === 'results' && stats.errors > 0 && (
                  <>
                    <Button onClick={retryFailed} variant="outline" size="sm">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Fix & Retry Failed
                    </Button>
                    <Button onClick={downloadErrorReport} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      Download Errors
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setParsedRows([]);
                    setPhase('select');
                    setHeaders([]);
                    setFilterStatus('all');
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <button
                onClick={() => setFilterStatus('all')}
                className={`p-3 rounded-md border text-center transition-colors ${filterStatus === 'all' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </button>
              <button
                onClick={() => setFilterStatus('valid')}
                className={`p-3 rounded-md border text-center transition-colors ${filterStatus === 'valid' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <p className="text-xl font-bold text-green-600">{stats.valid}</p>
                <p className="text-xs text-gray-500">Valid</p>
              </button>
              <button
                onClick={() => setFilterStatus('warning')}
                className={`p-3 rounded-md border text-center transition-colors ${filterStatus === 'warning' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <p className="text-xl font-bold text-yellow-600">{stats.warnings}</p>
                <p className="text-xs text-gray-500">Warnings</p>
              </button>
              <button
                onClick={() => setFilterStatus('error')}
                className={`p-3 rounded-md border text-center transition-colors ${filterStatus === 'error' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <p className="text-xl font-bold text-red-600">{stats.errors}</p>
                <p className="text-xs text-gray-500">Errors</p>
              </button>
              <button
                onClick={() => setFilterStatus('uploaded')}
                className={`p-3 rounded-md border text-center transition-colors ${filterStatus === 'uploaded' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <p className="text-xl font-bold text-blue-600">{stats.uploaded}</p>
                <p className="text-xs text-gray-500">Uploaded</p>
              </button>
            </div>
          </div>

          {/* Row List */}
          <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {filteredRows.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>No rows match the selected filter</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredRows.map((row) => (
                    <div key={row.rowIndex} className={`p-4 ${
                      row.status === 'uploaded' ? 'bg-green-50/50' :
                      row.status === 'error' ? 'bg-red-50/50' :
                      row.status === 'warning' ? 'bg-yellow-50/30' : ''
                    }`}>
                      {/* Row Header */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          {row.status === 'uploaded' && <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />}
                          {row.status === 'valid' && <Check className="h-5 w-5 text-green-500 flex-shrink-0" />}
                          {row.status === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />}
                          {row.status === 'error' && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                          <span className="text-sm font-medium text-gray-900">
                            Row {row.rowIndex}: {row.data.vehicle_year} {row.data.vehicle_make} {row.data.vehicle_model}
                          </span>
                          <span className="text-xs text-gray-500">
                            {row.data.client_name} &middot; {row.data.pickup_city}, {row.data.pickup_state} → {row.data.delivery_city}, {row.data.delivery_state}
                          </span>
                          {row.data.estimated_price && (
                            <span className="text-xs font-medium text-gray-700">${parseFloat(row.data.estimated_price || '0').toLocaleString()}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {row.status !== 'uploaded' && editingRow !== row.rowIndex && (
                            <>
                              <button onClick={() => startEdit(row.rowIndex)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit row">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => removeRow(row.rowIndex)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Remove row">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Inline Edit Form */}
                      {editingRow === row.rowIndex && (
                        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {REQUIRED_FIELDS.map(field => (
                              <div key={field}>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  {FIELD_LABELS[field]} <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={editData[field] || ''}
                                  onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))}
                                  className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-teal-500 focus:outline-none ${
                                    !editData[field]?.trim() ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                  }`}
                                />
                              </div>
                            ))}
                            {OPTIONAL_FIELDS.filter(f => headers.includes(f)).map(field => (
                              <div key={field}>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                  {FIELD_LABELS[field]}
                                </label>
                                <input
                                  type="text"
                                  value={editData[field] || ''}
                                  onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-end gap-2 mt-3">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingRow(null); setEditData({}); }}>
                              <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                            <Button size="sm" onClick={saveEdit} className="bg-teal-500 hover:bg-teal-600 text-white">
                              <Save className="h-4 w-4 mr-1" /> Save & Validate
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Error/Warning Messages */}
                      {(row.errors.length > 0 || row.warnings.length > 0) && editingRow !== row.rowIndex && (
                        <div className="mt-2 space-y-1">
                          {row.errors.map((err, idx) => (
                            <div key={`e-${idx}`} className="flex items-center gap-2 text-xs">
                              <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                              <span className="text-red-700">
                                <strong>{FIELD_LABELS[err.field] || err.field}:</strong> {err.message}
                              </span>
                              {row.status !== 'uploaded' && (
                                <button onClick={() => startEdit(row.rowIndex)} className="text-blue-600 hover:underline ml-1">
                                  Fix →
                                </button>
                              )}
                            </div>
                          ))}
                          {row.warnings.map((warn, idx) => (
                            <div key={`w-${idx}`} className="flex items-center gap-2 text-xs">
                              <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                              <span className="text-yellow-700">
                                <strong>{FIELD_LABELS[warn.field] || warn.field}:</strong> {warn.message}
                              </span>
                            </div>
                          ))}
                          {row.uploadError && (
                            <div className="flex items-center gap-2 text-xs">
                              <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                              <span className="text-red-700">
                                <strong>Upload Error:</strong> {row.uploadError}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assignment Strategy (Review phase only) */}
          {phase === 'review' && (
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-purple-600" />
                Assignment Strategy
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Choose how uploaded shipments are distributed to carriers after upload
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setAssignmentStrategy('load_board_network')}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    assignmentStrategy === 'load_board_network'
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-teal-600" />
                    <span className="font-semibold text-gray-900">Network Carriers Only</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Post to load board visible only to your network carriers. They can bid or accept directly. Best for established relationships.
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 text-xs rounded font-medium">Recommended</span>
                  </div>
                </button>
                <button
                  onClick={() => setAssignmentStrategy('load_board_public')}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    assignmentStrategy === 'load_board_public'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">Public Load Board</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Post to public load board. All verified drivers can see and bid. Maximizes carrier pool but may attract unknown carriers.
                  </p>
                </button>
                <button
                  onClick={() => setAssignmentStrategy('pending_manual')}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    assignmentStrategy === 'pending_manual'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-purple-600" />
                    <span className="font-semibold text-gray-900">Manual Assignment</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Keep as pending. You assign carriers manually from your shipments page. Full control over each assignment.
                  </p>
                </button>
              </div>

              {/* Commission breakdown preview */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="text-xs font-medium text-gray-700 mb-2">Pricing Breakdown (per shipment)</h4>
                <div className="grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500 block">Broker Commission</span>
                    <span className="text-purple-700 font-medium">Your configured rate from profile</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Platform Fee</span>
                    <span className="text-green-700 font-medium">10% of total price</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Carrier Payout</span>
                    <span className="text-blue-700 font-medium">Total − Commission − Platform Fee</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Visibility</span>
                    <span className="font-medium">{
                      assignmentStrategy === 'load_board_network' ? '🔒 Network carriers only' :
                      assignmentStrategy === 'load_board_public' ? '🌐 All verified drivers' :
                      '📋 Manual — not posted'
                    }</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Summary (after upload) */}
          {phase === 'results' && (
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Upload Complete
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{stats.uploaded}</div>
                  <div className="text-xs text-green-600">Shipments Created</div>
                </div>
                {loadBoardCount > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-700">{loadBoardCount}</div>
                    <div className="text-xs text-blue-600">Posted to Load Board</div>
                  </div>
                )}
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-700">
                    {assignmentStrategy === 'load_board_network' ? 'Network' :
                     assignmentStrategy === 'load_board_public' ? 'Public' : 'Manual'}
                  </div>
                  <div className="text-xs text-purple-600">Assignment Mode</div>
                </div>
                {stats.errors > 0 && (
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-700">{stats.errors}</div>
                    <div className="text-xs text-red-600">Failed — Fix & Retry</div>
                  </div>
                )}
              </div>
              {assignmentStrategy !== 'pending_manual' && (
                <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">
                  <strong>Next steps:</strong> {assignmentStrategy === 'load_board_network'
                    ? 'Your network carriers will be notified and can view & bid on these shipments. Monitor bids from your shipments page.'
                    : 'All verified drivers can now see and bid on these shipments on the public load board.'}
                </div>
              )}
              {assignmentStrategy === 'pending_manual' && (
                <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
                  <strong>Next steps:</strong> Go to your shipments page to manually assign carriers to each shipment or post them to the load board individually.
                </div>
              )}
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between bg-white rounded-md border border-gray-200 p-4">
            <div className="text-sm text-gray-600">
              {phase === 'review' && (
                <>
                  <strong>{stats.valid + stats.warnings}</strong> rows ready to upload
                  {stats.errors > 0 && (
                    <span className="text-red-600 ml-2">
                      ({stats.errors} with errors — fix them inline or remove)
                    </span>
                  )}
                </>
              )}
              {phase === 'results' && (
                <>
                  <strong className="text-green-600">{stats.uploaded}</strong> uploaded
                  {loadBoardCount > 0 && (
                    <span className="text-blue-600 ml-2">
                      · <strong>{loadBoardCount}</strong> on load board
                    </span>
                  )}
                  {stats.errors > 0 && (
                    <span className="text-red-600 ml-2">
                      · <strong>{stats.errors}</strong> failed
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-3">
              {phase === 'results' && (
                <Button onClick={() => router.push('/dashboard/broker/shipments')} className="bg-teal-500 hover:bg-teal-600 text-white">
                  View All Shipments
                </Button>
              )}
              {phase === 'review' && (
                <Button
                  onClick={handleUpload}
                  disabled={stats.valid + stats.warnings === 0}
                  className="bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {stats.valid + stats.warnings} Shipment{stats.valid + stats.warnings !== 1 ? 's' : ''}
                  {assignmentStrategy !== 'pending_manual' && ' & Post to Board'}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Phase: Uploading */}
      {phase === 'uploading' && (
        <div className="bg-white rounded-md border border-gray-200 p-8 text-center">
          <Loader2 className="h-10 w-10 text-teal-500 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Uploading Shipments...</h3>
          <p className="text-gray-600 mb-4">Processing {stats.valid + stats.warnings} rows</p>
          <div className="max-w-md mx-auto">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-teal-500 h-3 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-sm text-gray-500 mt-2">{uploadProgress}% complete</p>
          </div>
        </div>
      )}

      {/* Benji Chat Widget */}
      <BenjiChat context="dashboard" userId={profile?.id} userType="broker" />
    </div>
  );
}
