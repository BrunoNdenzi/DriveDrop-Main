'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { brokerProfileService } from '@/services/brokerService';
import type { BrokerProfile } from '@/types/broker';
import {
  Package,
  Upload,
  FileText,
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BrokerDocument {
  id: string;
  name: string;
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected';
}

const REQUIRED_DOCS = [
  { key: 'broker_authority', label: 'Broker Authority (MC)', required: true, description: 'Your FMCSA Broker Authority certificate' },
  { key: 'insurance_certificate', label: 'Insurance Certificate', required: true, description: 'Proof of cargo and liability insurance' },
  { key: 'w9_form', label: 'W-9 Form', required: true, description: 'Completed IRS W-9 form' },
  { key: 'business_license', label: 'Business License', required: false, description: 'State or local business license' },
  { key: 'surety_bond', label: 'Surety Bond ($75,000)', required: true, description: 'BMC-84 Surety Bond or BMC-85 Trust Fund' },
];

export default function BrokerDocumentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [documents, setDocuments] = useState<BrokerDocument[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const brokerProfile = await brokerProfileService.getByProfileId(user.id);
      setBroker(brokerProfile);

      // Load uploaded documents from storage
      const { data: files } = await supabase.storage
        .from('broker-documents')
        .list(`${brokerProfile.id}`);

      if (files) {
        const docs: BrokerDocument[] = files.map(f => ({
          id: f.id || f.name,
          name: f.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          file_name: f.name,
          file_url: supabase.storage.from('broker-documents').getPublicUrl(`${brokerProfile.id}/${f.name}`).data.publicUrl,
          file_size: f.metadata?.size || 0,
          uploaded_at: f.created_at || new Date().toISOString(),
          status: 'approved', // Default - would check from verification table
        }));
        setDocuments(docs);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (docKey: string, file: File) => {
    if (!broker) return;
    setUploading(docKey);
    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split('.').pop();
      const fileName = `${docKey}.${ext}`;

      const { error } = await supabase.storage
        .from('broker-documents')
        .upload(`${broker.id}/${fileName}`, file, { upsert: true });

      if (error) throw error;
      await loadData(); // Refresh
    } catch (err: any) {
      console.error('Upload error:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (doc: BrokerDocument) => {
    if (!broker || !confirm('Delete this document?')) return;
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.storage
        .from('broker-documents')
        .remove([`${broker.id}/${doc.file_name}`]);
      await loadData();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const getDocStatus = (docKey: string) => {
    return documents.find(d => d.file_name.startsWith(docKey));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const uploadedCount = REQUIRED_DOCS.filter(d => d.required && getDocStatus(d.key)).length;
  const requiredCount = REQUIRED_DOCS.filter(d => d.required).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Documents</h1>
          <p className="text-xs text-gray-500">
            Manage verification documents and compliance files
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Verification Progress */}
      <div className="bg-white rounded-md border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-600" />
            <span className="text-sm font-semibold text-gray-900">Verification Progress</span>
          </div>
          <span className="text-xs font-medium text-gray-600">
            {uploadedCount} / {requiredCount} required documents
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-teal-600 h-2 rounded-full transition-all"
            style={{ width: `${(uploadedCount / requiredCount) * 100}%` }}
          />
        </div>
        {broker?.verification_status === 'verified' && (
          <div className="flex items-center gap-2 mt-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Account Verified</span>
          </div>
        )}
        {broker?.verification_status === 'pending' && (
          <div className="flex items-center gap-2 mt-2 text-amber-700">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Verification Pending Review</span>
          </div>
        )}
      </div>

      {/* Required Documents */}
      <div className="bg-white rounded-md border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Required Documents</h2>
          <p className="text-xs text-gray-500 mt-1">Upload all required documents for account verification</p>
        </div>

        <div className="divide-y divide-gray-200">
          {REQUIRED_DOCS.map(doc => {
            const uploaded = getDocStatus(doc.key);
            return (
              <div key={doc.key} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                    uploaded ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {uploaded ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <FileText className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {doc.label}
                      {doc.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    <p className="text-xs text-gray-500">{doc.description}</p>
                    {uploaded && (
                      <p className="text-xs text-green-600 mt-1">
                        Uploaded {new Date(uploaded.uploaded_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {uploaded && (
                    <>
                      <a
                        href={uploaded.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-gray-100"
                      >
                        <Download className="h-4 w-4 text-gray-500" />
                      </a>
                      <button
                        onClick={() => handleDelete(uploaded)}
                        className="p-1.5 rounded hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </>
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(doc.key, file);
                      }}
                    />
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      uploading === doc.key
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}>
                      {uploading === doc.key ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      {uploaded ? 'Replace' : 'Upload'}
                    </span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Registration Info */}
      {broker && (
        <div className="bg-white rounded-md border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Registration Information</h2>
            <p className="text-xs text-gray-500 mt-1">Details provided during broker registration</p>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'MC Number', value: broker.mc_number },
              { label: 'DOT Number', value: broker.dot_number },
              { label: 'Broker License #', value: broker.broker_license_number },
              { label: 'Insurance Provider', value: broker.insurance_provider },
              { label: 'Insurance Policy #', value: broker.insurance_policy_number },
              { label: 'Insurance Expiry', value: broker.insurance_expiry_date ? new Date(broker.insurance_expiry_date).toLocaleDateString() : null },
              { label: 'Bond Number', value: broker.bond_number },
              { label: 'Bond Amount', value: broker.bond_amount ? `$${broker.bond_amount.toLocaleString()}` : null },
              { label: 'Tax ID', value: broker.tax_id ? `***${broker.tax_id.slice(-4)}` : null },
              { label: 'FMCSA Verified', value: broker.fmcsa_verified ? 'Yes' : 'No' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-xs font-medium text-gray-900">
                  {item.value || <span className="text-gray-400">Not provided</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info notice */}
      <div className="bg-teal-50 border border-teal-200 rounded-md p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-teal-600 mt-0.5" />
          <div className="text-xs text-teal-800">
            <strong>Note:</strong> All required documents must be uploaded for account verification.
            Documents are reviewed within 1-2 business days. Accepted formats: PDF, JPG, PNG (max 10MB).
          </div>
        </div>
      </div>
    </div>
  );
}
