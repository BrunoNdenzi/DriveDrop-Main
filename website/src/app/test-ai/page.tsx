'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AIDocumentUpload, NaturalLanguageShipmentCreator } from '@/components/ai'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs } from '@/components/ui/tabs'
import { AlertCircle } from 'lucide-react'

export default function AITestPage() {
  const router = useRouter()
  const [extractedData, setExtractedData] = useState<any>(null)
  const [createdShipment, setCreatedShipment] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setIsAuthenticated(false)
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login?redirect=/test-ai')
        }, 3000)
      } else {
        setIsAuthenticated(true)
      }
    }

    checkAuth()
  }, [])

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Show auth required message
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
            <p className="text-gray-600 mb-6">
              You need to be logged in to test AI features. Redirecting to login page...
            </p>
            <Button 
              onClick={() => router.push('/login?redirect=/test-ai')}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Go to Login
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🤖 Benji AI Test Page
          </h1>
          <p className="text-lg text-gray-600">
            Test Benji's AI-powered shipping assistant
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-amber-100 border border-amber-300 rounded-lg px-4 py-2">
            <span className="text-sm font-medium text-amber-900">
              ⚠️ OPENAI INTEGRATION PENDING
            </span>
          </div>
        </div>

        {/* Test Sections */}
        <div className="space-y-8">
          {/* Document Extraction Test */}
          <Card className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                1. Document Extraction Test
              </h2>
              <p className="text-gray-600">
                Upload a vehicle registration, title, or insurance card to test AI extraction
              </p>
            </div>

            <AIDocumentUpload
              documentType="registration"
              onExtracted={(data) => {
                console.log('Extracted data:', data)
                setExtractedData(data)
              }}
            />

            {extractedData && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Extracted Data:</h3>
                <pre className="text-sm text-gray-700 overflow-auto">
                  {JSON.stringify(extractedData, null, 2)}
                </pre>
              </div>
            )}
          </Card>

          {/* Natural Language Test */}
          <Card className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                1. 🤖 Benji Natural Language Shipping
              </h2>
              <p className="text-gray-600">
                Ask Benji to create a shipment using natural language
              </p>
            </div>

            <NaturalLanguageShipmentCreator
              variant="hero"
              onShipmentCreated={(shipment) => {
                console.log('Created shipment:', shipment)
                setCreatedShipment(shipment)
              }}
            />

            {createdShipment && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Created Shipment:</h3>
                <pre className="text-sm text-gray-700 overflow-auto">
                  {JSON.stringify(createdShipment, null, 2)}
                </pre>
              </div>
            )}
          </Card>

          {/* API Configuration Test */}
          <Card className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                3. Configuration Check
              </h2>
              <p className="text-gray-600">
                Verify your AI service configuration
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">API Base URL</p>
                  <p className="font-mono text-sm font-medium text-gray-900">
                    {process.env.NEXT_PUBLIC_API_URL || 'Not configured'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Authentication</p>
                  <p className="font-mono text-sm font-medium text-gray-900">
                    {typeof window !== 'undefined' && localStorage.getItem('token') ? '✅ Token found' : '❌ Not logged in'}
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Testing Checklist:</h4>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>Backend running on Railway with OPENAI_API_KEY configured</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>User logged in (check localStorage for token)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>NEXT_PUBLIC_API_URL set in .env.local</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">✓</span>
                    <span>Check browser console for any errors</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Example Data */}
          <Card className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                4. Example Test Data
              </h2>
              <p className="text-gray-600">
                Use these examples for testing
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Natural Language Examples:</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-gray-50 rounded border border-gray-200">
                    <code className="text-sm text-gray-700">
                      Ship my 2023 Honda Civic from Los Angeles, CA to New York, NY next week
                    </code>
                  </div>
                  <div className="p-3 bg-gray-50 rounded border border-gray-200">
                    <code className="text-sm text-gray-700">
                      Move my Tesla Model 3 VIN 5YJ3E1EA1MF000001 from San Francisco to Seattle ASAP
                    </code>
                  </div>
                  <div className="p-3 bg-gray-50 rounded border border-gray-200">
                    <code className="text-sm text-gray-700">
                      Transport a non-running 2019 Ford F-150 from Dallas, TX to Phoenix, AZ
                    </code>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Document Types to Test:</h3>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• Vehicle Registration (recommended)</li>
                  <li>• Vehicle Title</li>
                  <li>• Insurance Card</li>
                  <li>• Bill of Sale</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>This page is for development testing only.</p>
          <p className="mt-1">
            Remove or protect this page before deploying to production.
          </p>
        </div>
      </div>
    </div>
  )
}
