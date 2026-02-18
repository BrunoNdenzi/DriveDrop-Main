'use client';

import { useState, useRef } from 'react';
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
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BenjiChat } from '@/components/benji/BenjiChat';
import { useAuth } from '@/hooks/useAuth';

interface UploadResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export default function BulkUploadPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    const data = lines.slice(1, 6).map(line => { // Preview first 5 rows
      const values = line.split(',').map(v => v.trim());
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index] || '';
        return obj;
      }, {} as any);
    });

    setPreview(data);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const errors: Array<{ row: number; error: string }> = [];
    let successCount = 0;

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Get broker commission rate
      const { data: brokerProfile } = await supabase
        .from('broker_profiles')
        .select('default_commission_rate')
        .eq('user_id', user.id)
        .single();

      const commissionRate = brokerProfile?.default_commission_rate || 15;

      // Parse CSV
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Process each row
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim());
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });

          // Validate required fields
          const requiredFields = [
            'client_name', 'client_email', 'client_phone',
            'pickup_address', 'pickup_city', 'pickup_state', 'pickup_zip',
            'delivery_address', 'delivery_city', 'delivery_state', 'delivery_zip',
            'vehicle_year', 'vehicle_make', 'vehicle_model', 'vehicle_type',
            'estimated_price'
          ];

          for (const field of requiredFields) {
            if (!row[field]) {
              throw new Error(`Missing required field: ${field}`);
            }
          }

          // Calculate commission and fees
          const totalPrice = parseFloat(row.estimated_price);
          const brokerCommission = (totalPrice * commissionRate) / 100;
          const platformFee = (totalPrice * 10) / 100;

          // Insert shipment
          const { error } = await supabase
            .from('broker_shipments')
            .insert({
              broker_id: user.id,
              client_name: row.client_name,
              client_email: row.client_email,
              client_phone: row.client_phone,
              
              pickup_address: row.pickup_address,
              pickup_city: row.pickup_city,
              pickup_state: row.pickup_state,
              pickup_zip: row.pickup_zip,
              
              delivery_address: row.delivery_address,
              delivery_city: row.delivery_city,
              delivery_state: row.delivery_state,
              delivery_zip: row.delivery_zip,
              
              vehicle_year: parseInt(row.vehicle_year),
              vehicle_make: row.vehicle_make,
              vehicle_model: row.vehicle_model,
              vehicle_type: row.vehicle_type,
              vehicle_condition: row.vehicle_condition || 'running',
              vehicle_vin: row.vehicle_vin || null,
              
              distance_miles: parseFloat(row.distance_miles || '0'),
              estimated_price: totalPrice,
              broker_commission: brokerCommission,
              platform_fee: platformFee,
              
              pickup_date: row.pickup_date || null,
              delivery_date: row.delivery_date || null,
              
              transport_type: row.transport_type || 'open',
              is_operable: row.is_operable !== 'false',
              
              notes: row.notes || null,
              status: 'pending_quote',
            });

          if (error) throw error;
          successCount++;
        } catch (err: any) {
          errors.push({ row: i + 1, error: err.message });
        }
      }

      setResult({
        success: successCount,
        failed: errors.length,
        errors: errors
      });

    } catch (err: any) {
      console.error('Upload error:', err);
      alert('Failed to upload file: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `client_name,client_email,client_phone,pickup_address,pickup_city,pickup_state,pickup_zip,delivery_address,delivery_city,delivery_state,delivery_zip,vehicle_year,vehicle_make,vehicle_model,vehicle_type,vehicle_condition,vehicle_vin,estimated_price,distance_miles,pickup_date,delivery_date,transport_type,is_operable,notes
John Doe,john@example.com,555-1234,123 Main St,Los Angeles,CA,90001,456 Oak Ave,New York,NY,10001,2023,BMW,X5,SUV,running,1HGBH41JXMN109186,1200,2789,2025-01-15,2025-01-20,open,true,Handle with care
Jane Smith,jane@example.com,555-5678,789 Pine St,Miami,FL,33101,321 Elm St,Chicago,IL,60601,2022,Tesla,Model 3,Sedan,running,5YJ3E1EA0KF123456,950,1377,2025-01-16,2025-01-21,enclosed,true,
`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drivedrop_bulk_upload_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

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
            <p className="text-gray-600 mt-1">Upload multiple shipments at once using a CSV file</p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold">
              1
            </div>
            <h3 className="font-semibold text-gray-900">Download Template</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Download our CSV template with the required format and example data
          </p>
          <Button
            onClick={downloadTemplate}
            variant="outline"
            className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-600 rounded-md flex items-center justify-center text-white font-bold">
              2
            </div>
            <h3 className="font-semibold text-gray-900">Fill Your Data</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Fill in your shipment details following the template format. Ensure all required fields are included
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-600 rounded-md flex items-center justify-center text-white font-bold">
              3
            </div>
            <h3 className="font-semibold text-gray-900">Upload CSV</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Upload your completed CSV file and we'll process all shipments automatically
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-md border border-gray-200 p-4">
        <div className="max-w-2xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-gray-300 rounded-md p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <FileSpreadsheet className="h-8 w-8 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Click to upload CSV file
              </h3>
              <p className="text-sm text-gray-600">
                or drag and drop your file here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-md">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-600">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFile(null);
                    setPreview([]);
                    setResult(null);
                  }}
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>

              {preview.length > 0 && (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-900">Preview (First 5 rows)</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          {Object.keys(preview[0]).map(key => (
                            <th key={key} className="px-4 py-2 text-left font-medium text-gray-700">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, idx) => (
                          <tr key={idx} className="border-t border-gray-200">
                            {Object.values(row).map((value: any, i) => (
                              <td key={i} className="px-4 py-2 text-gray-600">
                                {value}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full bg-teal-500 hover:bg-teal-500"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Shipments
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Results</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-600">{result.success}</p>
                  <p className="text-sm text-gray-600">Successfully Uploaded</p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-semibold text-red-600">{result.failed}</p>
                  <p className="text-sm text-gray-600">Failed</p>
                </div>
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Errors
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {result.errors.map((error, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm font-medium text-red-900">Row {error.row}</p>
                    <p className="text-sm text-red-700">{error.error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button
              onClick={() => router.push('/dashboard/broker/shipments')}
              className="flex-1 bg-teal-500 hover:bg-teal-500"
            >
              View All Shipments
            </Button>
            <Button
              onClick={() => {
                setFile(null);
                setPreview([]);
                setResult(null);
              }}
              variant="outline"
              className="flex-1"
            >
              Upload Another File
            </Button>
          </div>
        </div>
      )}

      {/* Required Fields Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Required CSV Fields</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700 mb-2">Client Information</p>
            <ul className="text-gray-600 space-y-1">
              <li>• client_name</li>
              <li>• client_email</li>
              <li>• client_phone</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-2">Pickup Details</p>
            <ul className="text-gray-600 space-y-1">
              <li>• pickup_address</li>
              <li>• pickup_city</li>
              <li>• pickup_state</li>
              <li>• pickup_zip</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-2">Delivery Details</p>
            <ul className="text-gray-600 space-y-1">
              <li>• delivery_address</li>
              <li>• delivery_city</li>
              <li>• delivery_state</li>
              <li>• delivery_zip</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-2">Vehicle Information</p>
            <ul className="text-gray-600 space-y-1">
              <li>• vehicle_year</li>
              <li>• vehicle_make</li>
              <li>• vehicle_model</li>
              <li>• vehicle_type</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-2">Pricing</p>
            <ul className="text-gray-600 space-y-1">
              <li>• estimated_price</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-2">Optional Fields</p>
            <ul className="text-gray-600 space-y-1">
              <li>• vehicle_vin</li>
              <li>• pickup_date</li>
              <li>• delivery_date</li>
              <li>• notes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Benji Chat Widget - Help with bulk uploads */}
      <BenjiChat 
        context="dashboard" 
        userId={profile?.id}
        userType="broker"
      />
    </div>
  );
}
