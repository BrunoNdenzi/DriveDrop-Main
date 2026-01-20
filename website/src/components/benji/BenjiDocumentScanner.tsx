'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, Check, Loader2, FileText, Sparkles } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { aiService } from '@/services/aiService';
import toast from 'react-hot-toast';

interface DocumentScannerProps {
  onComplete?: (data: any) => void;
  onClose?: () => void;
  shipmentId?: string;
}

interface ExtractionProgress {
  stage: 'uploading' | 'analyzing' | 'extracting' | 'complete' | 'error';
  progress: number;
  message: string;
}

const DOCUMENT_TYPES = [
  { value: 'title', label: '🚗 Vehicle Title', description: 'Ownership document' },
  { value: 'bill_of_sale', label: '📄 Bill of Sale', description: 'Purchase receipt' },
  { value: 'insurance', label: '🛡️ Insurance Card', description: 'Coverage proof' },
  { value: 'inspection_report', label: '✅ Inspection Report', description: 'Vehicle condition' },
  { value: 'other', label: '📋 Other Document', description: 'Any vehicle doc' },
];

export const BenjiDocumentScanner = ({ 
  onComplete, 
  onClose,
  shipmentId 
}: DocumentScannerProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState('title');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress>({
    stage: 'uploading',
    progress: 0,
    message: 'Ready to scan...',
  });
  const [extractedData, setExtractedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.heic'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Could not access camera. Please upload a photo instead.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            stopCamera();
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const processDocument = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress({
      stage: 'uploading',
      progress: 10,
      message: 'Benji is receiving your document...',
    });

    try {
      // Upload and extract with AI service
      setProgress({
        stage: 'uploading',
        progress: 30,
        message: 'Uploading to secure storage...',
      });

      setProgress({
        stage: 'analyzing',
        progress: 50,
        message: '🤖 Benji is reading your document...',
      });

      // AI service handles upload and extraction
      const response = await aiService.extractDocument(selectedFile, documentType as any, shipmentId);

      setProgress({
        stage: 'extracting',
        progress: 80,
        message: 'Extracting vehicle information...',
      });

      // Simulate extraction progress for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));

      setProgress({
        stage: 'complete',
        progress: 100,
        message: '✨ Document scanned successfully!',
      });

      setExtractedData(response.data);

      // Auto-complete after showing success
      setTimeout(() => {
        if (onComplete) {
          onComplete(response.data);
        }
      }, 1500);

    } catch (error: any) {
      console.error('Document processing error:', error);
      setProgress({
        stage: 'error',
        progress: 0,
        message: 'Failed to process document. Please try again.',
      });
      toast.error('Failed to scan document. Please try again.');
    } finally {
      setTimeout(() => setIsProcessing(false), 2000);
    }
  };

  const handleClose = () => {
    stopCamera();
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-purple-600 p-6 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Benji Document Scanner</h2>
                <p className="text-white/80 text-sm">AI-powered instant extraction</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Document Type Selection */}
          {!selectedFile && !cameraActive && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What type of document are you scanning?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {DOCUMENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setDocumentType(type.value)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      documentType === type.value
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-200 bg-white'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{type.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Camera View */}
          <AnimatePresence>
            {cameraActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-6"
              >
                <div className="relative rounded-2xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-96 object-cover"
                  />
                  <div className="absolute inset-0 border-4 border-teal-500/50 pointer-events-none">
                    <div className="absolute top-4 left-4 right-4 bg-black/60 backdrop-blur p-3 rounded-lg">
                      <p className="text-white text-sm text-center">
                        📸 Position document in frame and tap capture
                      </p>
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                    <button
                      onClick={capturePhoto}
                      className="px-6 py-3 bg-teal-600 text-white rounded-full font-medium hover:bg-teal-700 transition-colors flex items-center space-x-2"
                    >
                      <Camera className="w-5 h-5" />
                      <span>Capture</span>
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-6 py-3 bg-gray-600 text-white rounded-full font-medium hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload Area */}
          {!selectedFile && !cameraActive && (
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={`border-3 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-300 hover:border-teal-400 bg-gray-50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {isDragActive ? 'Drop your document here' : 'Drag & drop your document'}
                </p>
                <p className="text-sm text-gray-500">
                  or click to browse (JPG, PNG, PDF)
                </p>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex-1 border-t border-gray-300" />
                <span className="text-sm text-gray-500">OR</span>
                <div className="flex-1 border-t border-gray-300" />
              </div>

              <button
                onClick={startCamera}
                className="w-full py-4 bg-gradient-to-r from-teal-600 to-purple-600 text-white rounded-2xl font-medium hover:shadow-lg transition-all flex items-center justify-center space-x-2"
              >
                <Camera className="w-5 h-5" />
                <span>Use Camera</span>
              </button>
            </div>
          )}

          {/* Preview & Processing */}
          {selectedFile && !isProcessing && (
            <div className="space-y-6">
              <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200">
                <img
                  src={previewUrl || ''}
                  alt="Document preview"
                  className="w-full h-96 object-contain bg-gray-50"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setExtractedData(null);
                  }}
                  className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-2xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Choose Different
                </button>
                <button
                  onClick={processDocument}
                  className="flex-1 py-3 bg-gradient-to-r from-teal-600 to-purple-600 text-white rounded-2xl font-medium hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Scan with Benji</span>
                </button>
              </div>
            </div>
          )}

          {/* Processing Progress */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Progress Animation */}
                <div className="text-center py-8">
                  <motion.div
                    animate={{
                      rotate: progress.stage === 'complete' ? 0 : 360,
                    }}
                    transition={{
                      duration: 2,
                      repeat: progress.stage === 'complete' ? 0 : Infinity,
                      ease: 'linear',
                    }}
                    className="w-24 h-24 mx-auto mb-6"
                  >
                    {progress.stage === 'complete' ? (
                      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                        <Check className="w-12 h-12 text-green-600" />
                      </div>
                    ) : progress.stage === 'error' ? (
                      <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
                        <X className="w-12 h-12 text-red-600" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-teal-500 to-purple-600 rounded-full flex items-center justify-center">
                        <Loader2 className="w-12 h-12 text-white animate-spin" />
                      </div>
                    )}
                  </motion.div>

                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {progress.message}
                  </h3>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-teal-500 to-purple-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{progress.progress}% complete</p>
                </div>

                {/* Extracted Data Preview */}
                {extractedData && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-teal-50 to-purple-50 rounded-2xl p-6"
                  >
                    <div className="flex items-center space-x-2 mb-4">
                      <FileText className="w-5 h-5 text-teal-600" />
                      <h4 className="font-semibold text-gray-900">Extracted Information</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {extractedData.vin && (
                        <div>
                          <span className="text-gray-500">VIN:</span>
                          <p className="font-medium text-gray-900">{extractedData.vin}</p>
                        </div>
                      )}
                      {extractedData.make && (
                        <div>
                          <span className="text-gray-500">Make:</span>
                          <p className="font-medium text-gray-900">{extractedData.make}</p>
                        </div>
                      )}
                      {extractedData.model && (
                        <div>
                          <span className="text-gray-500">Model:</span>
                          <p className="font-medium text-gray-900">{extractedData.model}</p>
                        </div>
                      )}
                      {extractedData.year && (
                        <div>
                          <span className="text-gray-500">Year:</span>
                          <p className="font-medium text-gray-900">{extractedData.year}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
