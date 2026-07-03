'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, CheckCircle, AlertCircle, ArrowRight, Mic, MicOff, X, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { aiService, BenjiChatResponse } from '@/services/aiService'
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
  const [result, setResult] = useState<BenjiChatResponse | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<{ traceId: string; riskScore: number; planSummary: string[]; message: string } | null>(null)
  // Phase 9.3 — clarification loop
  const [pendingClarification, setPendingClarification] = useState<{ traceId: string; question: string } | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [showDocScanner, setShowDocScanner] = useState(false)
  // Phase 9.3 — stable sessionId so the clarification resume works across turns
  const [sessionId] = useState(() => Math.random().toString(36).slice(2))
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
        recognitionRef.current.continuous = true // Keep listening
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = 'en-US'
        recognitionRef.current.maxAlternatives = 1

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
          setIsListening(false)
          
          switch (event.error) {
            case 'not-allowed':
              toast.error('🎤 Microphone access denied. Please enable it in your browser settings.')
              break
            case 'no-speech':
              toast('No speech detected. Click Voice again to try.', { 
                icon: '🎤',
                duration: 2000 
              })
              break
            case 'network':
              toast.error('Network error. Please check your connection.')
              break
            case 'aborted':
              // User manually stopped - silent
              break
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

  const toggleVoiceInput = async () => {
    if (!recognitionRef.current) {
      toast.error('Voice input not supported in your browser. Try Chrome or Edge.')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      toast('Voice input stopped', { icon: '⏸️', duration: 1500 })
    } else {
      try {
        // Request microphone access with audio enhancements
        await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        })
        
        recognitionRef.current.start()
        setIsListening(true)
        
        toast('🎤 Listening... Start speaking now!', { 
          duration: 4000,
          style: {
            background: '#ef4444',
            color: 'white',
            fontWeight: 'bold'
          }
        })
      } catch (error: any) {
        setIsListening(false)
        
        if (error.name === 'NotAllowedError') {
          toast.error('🚫 Microphone access denied. Please allow microphone access.')
        } else if (error.name === 'NotFoundError') {
          toast.error('❌ No microphone found. Please check your device.')
        } else {
          toast.error('Failed to access microphone.')
        }
      }
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
    setPendingConfirmation(null)
    setIsProcessing(true)

    try {
      const response = await aiService.benjiChat(prompt, {
        // Phase 9.3: send clarificationTraceId when answering a follow-up question
        ...(pendingClarification ? { clarificationTraceId: pendingClarification.traceId } : {}),
      })

      // Phase 9.3: clarification — show the follow-up question, NOT an error
      if (response.state === 'CLARIFICATION_REQUIRED' && response.clarificationRequest) {
        setPendingClarification({ traceId: response.traceId ?? '', question: response.clarificationRequest })
        setPrompt('')   // clear input so user types their answer
        return
      }

      // Clear clarification state on any other outcome
      setPendingClarification(null)

      if (response.state === 'AWAIT_CONFIRMATION' && response.confirmationPayload) {
        // Benji needs user approval before creating the shipment
        setPendingConfirmation(response.confirmationPayload)
      } else if (response.success && response.shipmentCreated) {
        setResult(response)
        if (onShipmentCreated) {
          onShipmentCreated(response.shipmentCreated)
        }
        setTimeout(() => {
          router.push(`/dashboard/client/shipments/${response.shipmentCreated!.shipment_id}`)
        }, 2000)
      } else {
        setError(response.error ?? response.response ?? 'Failed to create shipment')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process your request')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirm = async () => {
    if (!pendingConfirmation) return
    setIsConfirming(true)
    try {
      const response = await aiService.benjiConfirm(pendingConfirmation.traceId, true)
      setPendingConfirmation(null)
      if (response.success && response.shipmentCreated) {
        setResult(response)
        if (onShipmentCreated) {
          onShipmentCreated(response.shipmentCreated)
        }
        setTimeout(() => {
          router.push(`/dashboard/client/shipments/${response.shipmentCreated!.shipment_id}`)
        }, 2000)
      } else {
        setError(response.error ?? 'Shipment creation failed after confirmation')
      }
    } catch (err: any) {
      setError(err.message || 'Confirmation failed')
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCancelConfirm = async () => {
    if (!pendingConfirmation) return
    // Decline — call confirm with confirmed: false
    try { await aiService.benjiConfirm(pendingConfirmation.traceId, false) } catch { /* ignore */ }
    setPendingConfirmation(null)
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
        <div className="glass rounded-md p-4 border border-white/20">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full border border-purple-200 mb-4">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">Benji AI Assistant</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
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
                className="text-lg resize-none pr-12 bg-white/80 backdrop-blur border-2 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
                  "px-4 py-3 rounded-md font-medium transition-all flex items-center space-x-2 border-2",
                  isListening
                    ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                    : "bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50"
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
                className="px-4 py-3 rounded-md font-medium transition-all flex items-center space-x-2 border-2 bg-white border-gray-300 text-gray-700 hover:border-purple-300 hover:bg-purple-50"
              >
                <Camera className="w-5 h-5" />
                <span>Scan Doc</span>
              </button>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isProcessing || !prompt.trim()}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-lg py-3 group"
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
                    className="text-left text-sm p-3 rounded-md bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600 group-hover:text-gray-900">{example}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirmation Required */}
          {pendingConfirmation && (
            <div className="mt-6 bg-amber-50 border-2 border-amber-300 rounded-md p-4 animate-slide-up">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-amber-900">Benji needs your approval</h3>
                  <p className="text-sm text-amber-800 mt-1 mb-3">{pendingConfirmation.message}</p>
                  {pendingConfirmation.planSummary.length > 0 && (
                    <ul className="text-sm text-amber-700 mb-4 list-disc list-inside space-y-1">
                      {pendingConfirmation.planSummary.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleConfirm}
                      disabled={isConfirming}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                      Confirm &amp; Create Shipment
                    </Button>
                    <Button
                      onClick={handleCancelConfirm}
                      disabled={isConfirming}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Result */}
          {result?.success && result.shipmentCreated && (
            <div className="mt-6 bg-green-50 border-2 border-green-200 rounded-md p-4 animate-slide-up">
              <div className="flex items-start gap-4">
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-900">
                    ✨ Benji Created Your Shipment!
                  </h3>

                  <div className="grid grid-cols-2 gap-4 text-sm bg-white rounded-md p-4 mt-3">
                    <div>
                      <span className="text-gray-600">Vehicle:</span>
                      <p className="font-medium text-gray-900">{result.shipmentCreated.vehicle}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">From:</span>
                      <p className="font-medium text-gray-900">{result.shipmentCreated.pickupAddress}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">To:</span>
                      <p className="font-medium text-gray-900">{result.shipmentCreated.deliveryAddress}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Estimated Price:</span>
                      <p className="font-medium text-blue-600">${result.shipmentCreated.estimatedPrice.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Phase 9.3 — Clarification question bubble (inline variant) */}
          {pendingClarification && (
            <div className="mt-4 flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1 bg-purple-50 border border-purple-200 rounded-2xl rounded-tl-none px-4 py-3">
                <p className="text-sm font-medium text-purple-900">Benji needs a bit more info</p>
                <p className="text-sm text-purple-800 mt-1">{pendingClarification.question}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 bg-red-50 border-2 border-red-200 rounded-md p-4">
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
      {/* Input Mode Indicators */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-md border border-blue-200">
        <Sparkles className="h-6 w-6 text-blue-500 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">How to use Benji:</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Type your request below, or click 🎤 Voice to speak, or 📸 Scan Doc to upload a document
          </p>
        </div>
        {isListening && (
          <div className="flex items-center gap-2 text-sm text-red-600 font-medium animate-pulse">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
            Listening...
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Example: 'Ship my 2023 Honda Civic from Los Angeles to Miami next week'"
            rows={4}
            disabled={isProcessing}
            className="resize-none text-base"
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
              "px-4 py-3 rounded-md font-medium transition-all flex items-center space-x-2 border-2",
              isListening
                ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                : "bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50"
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
            className="px-4 py-3 rounded-md font-medium transition-all flex items-center space-x-2 border-2 bg-white border-gray-300 text-gray-700 hover:border-purple-300 hover:bg-purple-50"
          >
            <Camera className="w-5 h-5" />
            <span>Scan Doc</span>
          </button>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isProcessing || !prompt.trim()}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3"
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
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Examples - Only show when no input */}
      {!prompt && !result && !error && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Try these examples:</p>
          <div className="grid grid-cols-1 gap-2">
            {examples.map((example, idx) => (
              <button
                key={idx}
                onClick={() => handleExampleClick(example)}
                className="text-left text-sm p-3 rounded-md bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-all group"
              >
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600 group-hover:text-gray-900">{example}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Required — inline variant */}
      {pendingConfirmation && (
        <div className="bg-amber-50 border border-amber-300 rounded-md p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <span className="font-medium text-amber-900">Benji needs your approval</span>
          </div>
          <p className="text-sm text-amber-700 mb-3">{pendingConfirmation.message}</p>
          <div className="flex gap-2">
            <Button onClick={handleConfirm} disabled={isConfirming} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
              {isConfirming ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
            <Button onClick={handleCancelConfirm} disabled={isConfirming} size="sm" variant="outline">Cancel</Button>
          </div>
        </div>
      )}

      {/* Success Result */}
      {result?.success && result.shipmentCreated && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-900">Benji created your shipment!</span>
          </div>
          <div className="text-sm text-green-700 space-y-1">
            <p>• {result.shipmentCreated.vehicle}</p>
            <p>• From: {result.shipmentCreated.pickupAddress}</p>
            <p>• To: {result.shipmentCreated.deliveryAddress}</p>
          </div>
        </div>
      )}

      {/* Phase 9.3 — Clarification question bubble (inline variant) */}
      {pendingClarification && (
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <div className="flex-1 bg-purple-50 border border-purple-200 rounded-2xl rounded-tl-none px-3 py-2">
            <p className="text-xs font-semibold text-purple-800">Benji</p>
            <p className="text-sm text-purple-800 mt-0.5">{pendingClarification.question}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
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
