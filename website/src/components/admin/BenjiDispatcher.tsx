'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Zap, TrendingUp, DollarSign, Clock, CheckCircle, AlertTriangle, Loader2, User, MapPin, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

interface DriverLoadMatch {
  load: any
  driver: any
  score: number
  confidence: number
  reasons: string[]
  estimated_earnings: number
  route_fit: number
  distance_to_pickup: number
}

interface DispatchAnalysis {
  unassigned_loads: number
  available_drivers: number
  optimal_matches: DriverLoadMatch[]
  efficiency_score: number
  estimated_revenue: number
  estimated_fuel_savings: number
  time_saved_hours: number
}

export default function BenjiDispatcher() {
  const [analysis, setAnalysis] = useState<DispatchAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set())

  useEffect(() => {
    analyzeOpportunities()
  }, [])

  const analyzeOpportunities = async () => {
    setIsAnalyzing(true)
    try {
      // Get auth token from Supabase session
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No authentication token available')
      }

      const response = await fetch('https://drivedrop-main-production.up.railway.app/api/v1/ai/dispatcher/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) throw new Error('Analysis failed')

      const data = await response.json()
      setAnalysis(data.analysis)

      // Auto-select all high-confidence matches (>80%)
      const autoSelect = new Set<string>(
        data.analysis.optimal_matches
          .filter((m: DriverLoadMatch) => m.confidence > 80)
          .map((m: DriverLoadMatch) => m.load.id)
      )
      setSelectedMatches(autoSelect)

      toast.success(`Found ${data.analysis.optimal_matches.length} optimal assignments!`)
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error('Failed to analyze dispatch opportunities')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const autoAssignAll = async () => {
    if (!analysis) return

    const matchesToAssign = analysis.optimal_matches.filter(m => 
      selectedMatches.has(m.load.id)
    )

    if (matchesToAssign.length === 0) {
      toast.error('No assignments selected')
      return
    }

    setIsAssigning(true)
    try {
      // Get auth token from Supabase session
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No authentication token available')
      }

      const response = await fetch('https://drivedrop-main-production.up.railway.app/api/v1/ai/dispatcher/auto-assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ matches: matchesToAssign })
      })

      if (!response.ok) throw new Error('Assignment failed')

      const data = await response.json()
      
      toast.success(`✅ ${data.result.success} loads assigned successfully!`, {
        duration: 5000
      })

      if (data.result.failed > 0) {
        toast.error(`⚠️ ${data.result.failed} assignments failed`)
      }

      // Refresh analysis
      setTimeout(() => analyzeOpportunities(), 2000)
    } catch (error) {
      console.error('Assignment error:', error)
      toast.error('Failed to auto-assign loads')
    } finally {
      setIsAssigning(false)
    }
  }

  const toggleMatch = (loadId: string) => {
    const newSelected = new Set(selectedMatches)
    if (newSelected.has(loadId)) {
      newSelected.delete(loadId)
    } else {
      newSelected.add(loadId)
    }
    setSelectedMatches(newSelected)
  }

  if (isAnalyzing) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">Benji is analyzing dispatch opportunities...</p>
          <p className="text-sm text-gray-500 mt-2">Calculating optimal driver-load matches</p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Unable to load dispatch analysis</p>
        <Button onClick={analyzeOpportunities} className="mt-4">
          Retry Analysis
        </Button>
      </div>
    )
  }

  const selectedCount = selectedMatches.size
  const totalRevenue = analysis.optimal_matches
    .filter(m => selectedMatches.has(m.load.id))
    .reduce((sum, m) => sum + m.load.estimated_price, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-8 w-8" />
              <h2 className="text-2xl font-bold">Benji AI Dispatcher</h2>
            </div>
            <p className="text-teal-100">
              Intelligent load assignment powered by AI
            </p>
          </div>
          <Button
            onClick={analyzeOpportunities}
            disabled={isAnalyzing}
            variant="outline"
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="text-teal-200 text-sm font-medium">Unassigned Loads</div>
            <div className="text-3xl font-bold mt-1">{analysis.unassigned_loads}</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="text-teal-200 text-sm font-medium">Available Drivers</div>
            <div className="text-3xl font-bold mt-1">{analysis.available_drivers}</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="text-teal-200 text-sm font-medium">Efficiency Score</div>
            <div className="text-3xl font-bold mt-1">{analysis.efficiency_score}%</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <div className="text-teal-200 text-sm font-medium">Est. Revenue</div>
            <div className="text-3xl font-bold mt-1">${(analysis.estimated_revenue / 1000).toFixed(1)}k</div>
          </div>
        </div>
      </div>

      {/* Benefits Banner */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-900">
                <strong>{analysis.time_saved_hours.toFixed(1)}h</strong> saved
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-900">
                <strong>{analysis.efficiency_score}%</strong> efficiency
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-900">
                <strong>${analysis.estimated_fuel_savings}</strong> fuel savings
              </span>
            </div>
          </div>
          <Button
            onClick={autoAssignAll}
            disabled={isAssigning || selectedCount === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Auto-Assign {selectedCount} Load{selectedCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Optimal Matches */}
      {analysis.optimal_matches.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900">All loads assigned!</p>
          <p className="text-gray-600 mt-2">No pending assignments at the moment</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Optimal Assignments ({analysis.optimal_matches.length})
            </h3>
            <div className="text-sm text-gray-600">
              {selectedCount} selected · ${totalRevenue.toFixed(0)} revenue
            </div>
          </div>

          <div className="space-y-3">
            {analysis.optimal_matches.map((match, idx) => (
              <div
                key={match.load.id}
                className={`bg-white border-2 rounded-xl p-6 transition-all cursor-pointer ${
                  selectedMatches.has(match.load.id)
                    ? 'border-teal-500 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => toggleMatch(match.load.id)}
              >
                <div className="flex items-start justify-between">
                  {/* Match Rank */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-purple-600 text-white font-bold text-lg">
                      {idx + 1}
                    </div>

                    {/* Load Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">
                          Load #{match.load.id.slice(0, 8)}
                        </h4>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                          {match.score}% Match
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          {match.confidence}% Confidence
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1 mb-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{match.load.pickup_address} → {match.load.delivery_address}</span>
                        </div>
                        {match.load.vehicle_make && (
                          <div>
                            🚗 {match.load.vehicle_year} {match.load.vehicle_make} {match.load.vehicle_model}
                          </div>
                        )}
                      </div>

                      {/* Reasons */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {match.reasons.slice(0, 4).map((reason, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-teal-50 text-teal-700 rounded-full"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>

                      {/* Driver Info */}
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <User className="h-5 w-5 text-gray-400" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{match.driver.full_name}</div>
                          <div className="text-xs text-gray-600">
                            {match.distance_to_pickup.toFixed(0)} mi away · ${match.estimated_earnings} earnings
                          </div>
                        </div>
                        {match.driver.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            <span className="text-sm font-medium">{match.driver.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selection Checkbox */}
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={selectedMatches.has(match.load.id)}
                      onChange={() => toggleMatch(match.load.id)}
                      className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
