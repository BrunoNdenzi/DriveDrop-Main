'use client';

import React, { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

interface DocumentExtractionQueue {
  id: string;
  shipment_id: string;
  document_url: string;
  document_type: 'bill_of_sale' | 'title' | 'insurance' | 'inspection_report' | 'other';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review';
  extracted_data: any;
  confidence_score: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export default function AIReviewQueuePage() {
  const [documents, setDocuments] = useState<DocumentExtractionQueue[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentExtractionQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'needs_review' | 'all'>('needs_review');
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    loadDocuments();
  }, [filter]);

  async function loadDocuments() {
    try {
      setLoading(true);
      let query = supabase
        .from('document_extraction_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'needs_review') {
        query = query.eq('status', 'needs_review');
      }

      const { data, error } = await query;

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function approveDocument(docId: string) {
    try {
      const { error } = await supabase
        .from('document_extraction_queue')
        .update({
          status: 'completed',
          reviewed_at: new Date().toISOString(),
          // reviewed_by would come from auth context
        })
        .eq('id', docId);

      if (error) throw error;

      alert('✅ Document approved and data saved!');
      setSelectedDoc(null);
      await loadDocuments();
    } catch (error) {
      console.error('Error approving document:', error);
      alert('Failed to approve document');
    }
  }

  async function rejectDocument(docId: string) {
    const reason = prompt('Enter rejection reason (optional):');
    
    try {
      const { error } = await supabase
        .from('document_extraction_queue')
        .update({
          status: 'failed',
          error_message: reason || 'Rejected by admin',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', docId);

      if (error) throw error;

      alert('❌ Document rejected');
      setSelectedDoc(null);
      await loadDocuments();
    } catch (error) {
      console.error('Error rejecting document:', error);
      alert('Failed to reject document');
    }
  }

  const getConfidenceColor = (score: number | null) => {
    if (!score) return 'text-gray-500';
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (score: number | null) => {
    if (!score) return 'Unknown';
    if (score >= 0.9) return 'High';
    if (score >= 0.75) return 'Medium';
    return 'Low';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">AI Document Review Queue</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('needs_review')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'needs_review' ? 'bg-yellow-600 text-white' : 'bg-gray-200'
            }`}
          >
            Needs Review
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            All Documents
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            {filter === 'needs_review' ? 'No documents need review! 🎉' : 'No documents found'}
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Documents List */}
          <div className="lg:col-span-1 space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`bg-white rounded-lg p-4 border-2 cursor-pointer transition ${
                  selectedDoc?.id === doc.id ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">
                    {doc.document_type === 'bill_of_sale' ? '📄' :
                     doc.document_type === 'title' ? '📜' :
                     doc.document_type === 'insurance' ? '🛡️' :
                     doc.document_type === 'inspection_report' ? '🔍' : '📋'}
                  </span>
                  <span className={`text-xs font-bold ${getConfidenceColor(doc.confidence_score)}`}>
                    {getConfidenceLabel(doc.confidence_score)} Confidence
                  </span>
                </div>
                <h4 className="font-bold capitalize text-sm mb-1">
                  {doc.document_type.replace('_', ' ')}
                </h4>
                <p className="text-xs text-gray-500">
                  {new Date(doc.created_at).toLocaleString()}
                </p>
                {doc.confidence_score && (
                  <div className="mt-2 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        doc.confidence_score >= 0.9 ? 'bg-green-500' :
                        doc.confidence_score >= 0.75 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${doc.confidence_score * 100}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Document Review Panel */}
          <div className="lg:col-span-2">
            {selectedDoc ? (
              <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2 capitalize">
                      {selectedDoc.document_type.replace('_', ' ')}
                    </h2>
                    <p className="text-sm text-gray-600">
                      Submitted: {new Date(selectedDoc.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${getConfidenceColor(selectedDoc.confidence_score)}`}>
                      {selectedDoc.confidence_score ? `${(selectedDoc.confidence_score * 100).toFixed(1)}%` : 'N/A'}
                    </div>
                    <p className="text-sm text-gray-600">Confidence Score</p>
                  </div>
                </div>

                {/* Document Image */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-bold mb-3">Document Image</h3>
                  <img
                    src={selectedDoc.document_url}
                    alt="Document"
                    className="w-full rounded-lg border border-gray-300"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-document.png';
                    }}
                  />
                </div>

                {/* Extracted Data */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-bold mb-3">Extracted Data</h3>
                  {selectedDoc.extracted_data ? (
                    <div className="space-y-2">
                      {Object.entries(selectedDoc.extracted_data).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center py-2 border-b last:border-b-0">
                          <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>
                          <span className="text-gray-700">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No data extracted yet</p>
                  )}
                </div>

                {/* Action Buttons */}
                {selectedDoc.status === 'needs_review' && (
                  <div className="flex gap-4">
                    <button
                      onClick={() => approveDocument(selectedDoc.id)}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold"
                    >
                      ✅ Approve & Save Data
                    </button>
                    <button
                      onClick={() => rejectDocument(selectedDoc.id)}
                      className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-bold"
                    >
                      ❌ Reject Document
                    </button>
                  </div>
                )}

                {selectedDoc.status === 'completed' && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-green-800 font-bold">✅ Document Approved</p>
                    {selectedDoc.reviewed_at && (
                      <p className="text-sm text-green-600">
                        Reviewed: {new Date(selectedDoc.reviewed_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {selectedDoc.status === 'failed' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                    <p className="text-red-800 font-bold">❌ Document Rejected</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-12 border border-gray-200 text-center">
                <p className="text-gray-500">Select a document to review</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
