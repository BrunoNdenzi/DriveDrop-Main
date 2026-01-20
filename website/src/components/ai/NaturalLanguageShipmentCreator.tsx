'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, CheckCircle, AlertCircle, ArrowRight, Mic, MicOff, X, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { aiService, NaturalLanguageShipmentResponse } from '@/services/aiService'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { BenjiDocumentScanner } from '@/components/benji/BenjiDocumentScanner'
import toast from 'react-hot-toast'

interface NaturalLanguageShipmentCreatorProps {
  onShipmentCreated?: (shipment: any) => void
  className?: string
  variant?: 'hero' | 'inline' // Hero for homepage, inline for forms
}

export default function NaturalLanguageShipmentCreator({
  onShipmentCreated,
  className,
  variant = 'inline'
}: NaturalLanguageShipmentCreatorProps) {
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<NaturalLanguageShipmentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [showDocScanner, setShowDocScanner] = useState(false)
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  const examples = [
    "Ship my 2023 Honda Civic from Los Angeles to New York next week",
    "Move my Tesla Model 3 VIN 5YJ3E1EA1MF000001 from San Francisco to Seattle ASAP",
    "Transport a non-running 2019 Ford F-150 from Dallas to Phoenix"
  ]

  // Initialize voice recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = 'en-US'

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join('')
          
          setPrompt(transcript)
        }

        recognitionRef.current.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
          if (event.error === 'not-allowed') {
            toast.error('Microphone access denied. Please enable it in your browser settings.')
          }
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast.error('Voice input not supported in your browser')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
      toast.success('🎤 Listening... Speak now!')
    }
  }

  const handleDocumentScanned = (data: any) => {
    // Auto-fill prompt from scanned document
    let generatedPrompt = 'Ship my '
    
    if (data.year) generatedPrompt += `${data.year} `
    if (data.make) generatedPrompt += `${data.make} `
    if (data.model) generatedPrompt += `${data.model} `
    if (data.vin) generatedPrompt += `VIN ${data.vin} `
    
    generatedPrompt += 'from [pickup location] to [delivery location]'
    
    setPrompt(generatedPrompt)
    setShowDocScanner(false)
    toast.success('Document scanned! Please add pickup and delivery locations.')
    textareaRef.current?.focus()
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!prompt.trim()) {
      setError('Please enter a shipping request')
      return
    }

    setError(null)
    setResult(null)
    setIsProcessing(true)

    try {
      const response = await aiService.createShipmentFromPrompt(prompt, 'text')
      
      if (response.success && (response.shipment || response.shipment_id)) {
        setResult(response)
        
        // Get shipment ID from either response format
        const shipmentId = response.shipment?.id || response.shipment_id
        
        // Call callback if provided
        if (onShipmentCreated) {
          onShipmentCreated(response.shipment || { id: shipmentId })
        }

        // Stay on page for testing - redirect disabled
        // TODO: Re-enable redirect after testing complete
        /*
        if (shipmentId) {
          setTimeout(() => {
            router.push(`/dashboard/client/shipments/${shipmentId}`)
          }, 2000)
        }
        */
      } else {
        setError(response.error || 'Failed to create shipment from prompt')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process your request')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExampleClick = (example: string) => {
    setPrompt(example)
    textareaRef.current?.focus()
  }

  const handleClear = () => {
    setPrompt('')
    setResult(null)
    setError(null)
    textareaRef.current?.focus()
  }

  // Hero variant - used on homepage
  if (variant === 'hero') {
    return (
      <div className={cn('max-w-4xl mx-auto', className)}>
        <div className="glass rounded-3xl p-8 shadow-xl border border-white/20">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-50 to-teal-50 px-4 py-2 rounded-full border border-purple-200 mb-4">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">Benji AI Assistant</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Tell Benji what you need to ship
            </h2>
            <p className="text-lg text-gray-600">
              Just describe your shipment naturally, Benji will handle the rest
            </p>
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Try: 'Ship my 2023 Honda Civic from Los Angeles to New York next week'"
                rows={4}
                disabled={isProcessing}
                className="text-lg resize-none pr-12 bg-white/80 backdrop-blur border-2 border-gray-300 focus:border-teal-500 focus:ring-teal-500"
              />
              {prompt && !isProcessing && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute top-3 right-3 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="flex gap-3">
              {/* Voice Input Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={isProcessing}
                className={cn(
                  "px-4 py-3 rounded-xl font-medium transition-all flex items-center space-x-2 border-2",
                  isListening
                    ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                    : "bg-white border-gray-300 text-gray-700 hover:border-teal-300 hover:bg-teal-50"
                )}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-5 h-5 animate-pulse" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    <span>Voice</span>
                  </>
                )}
              </button>

              {/* Document Scanner Button */}
              <button
                type="button"
                onClick={() => setShowDocScanner(true)}
                disabled={isProcessing}
                className="px-4 py-3 rounded-xl font-medium transition-all flex items-center space-x-2 border-2 bg-white border-gray-300 text-gray-700 hover:border-purple-300 hover:bg-purple-50"
              >
                <Camera className="w-5 h-5" />
                <span>Scan Doc</span>
              </button>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isProcessing || !prompt.trim()}
                className="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-lg py-6 shadow-lg shadow-teal-600/20 group"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Create
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Examples */}
          {!result && !error && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Try these examples:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {examples.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(example)}
                    className="text-left text-sm p-3 rounded-lg bg-gray-50 hover:bg-teal-50 border border-gray-200 hover:border-teal-300 transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-gray-400 group-hover:text-teal-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600 group-hover:text-gray-900">{example}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Success Result */}
          {result?.success && result.shipment && (
            <div className="mt-6 bg-green-50 border-2 border-green-200 rounded-xl p-6 animate-slide-up">
              <div className="flex items-start gap-4">
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-900">
                    ✨ Benji Created Your Shipment!
                  </h3>
                  <p className="text-sm text-green-700 mt-1 mb-4">
                    Extracted with {((result.confidence || 0) * 100).toFixed(0)}% confidence
                  </p>

                  <div className="grid grid-cols-2 gap-4 text-sm bg-white rounded-lg p-4">
                    <div>
                      <span className="text-gray-600">Vehicle:</span>
                      <p className="font-medium text-gray-900">
                        {result.extractedData?.vehicle?.year || result.shipment?.vehicle_year || ''} {result.extractedData?.vehicle?.make || result.shipment?.vehicle_make || ''} {result.extractedData?.vehicle?.model || result.shipment?.vehicle_model || ''}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">From:</span>
                      <p className="font-medium text-gray-900">{result.extractedData?.pickup?.location || result.shipment?.pickup_address || ''}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">To:</span>
                      <p className="font-medium text-gray-900">{result.extractedData?.delivery?.location || result.shipment?.delivery_address || ''}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Estimated Price:</span>
                      <p className="font-medium text-teal-700">${(result.shipment.estimated_price || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 bg-red-50 border-2 border-red-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900">Couldn't Process Request</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  <Button
                    onClick={handleClear}
                    variant="outline"
                    size="sm"
                    className="mt-4"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Inline variant - used in forms
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">Quick Create with Benji</h3>
        <div className="ml-auto">
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
            Beta
          </span>
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Tell Benji what you need: 'Ship my 2023 Honda from LA to NYC next week'"
            rows={3}
            disabled={isProcessing}
            className="resize-none"
          />
          {prompt && !isProcessing && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-3 w-3 text-gray-400" />
            </button>
          )}
        </div>

        <Button
          type="submit"
          disabled={isProcessing || !prompt.trim()}
          className="w-full bg-teal-600 hover:bg-teal-700"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Benji is working...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Create with Benji
            </>
          )}
        </Button>
      </form>

      {/* Success Result */}
      {result?.success && result.shipment && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-900">Benji created your shipment!</span>
          </div>
          <div className="text-sm text-green-700 space-y-1">
            <p>• {result.shipment.vehicle_year} {result.shipment.vehicle_make} {result.shipment.vehicle_model}</p>
            <p>• From: {result.shipment.pickup_address}</p>
            <p>• To: {result.shipment.delivery_address}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Document Scanner Modal */}
      {showDocScanner && (
        <BenjiDocumentScanner
          onComplete={handleDocumentScanned}
          onClose={() => setShowDocScanner(false)}
        />
      )}
    </div>
  )
}
