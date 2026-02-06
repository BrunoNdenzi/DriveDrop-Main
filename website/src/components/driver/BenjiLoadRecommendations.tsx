'use client'

import { useState, useEffect } from 'react'
import { Sparkles, MapPin, DollarSign, TrendingUp, Clock, Star, Navigation, Zap, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

interface LoadRecommendation {
  load: any
  match_score: number
  confidence: number
  reasons: string[]
  estimated_earnings: number
  distance_to_pickup: number
  route_fit: number
  priority: 'best' | 'good' | 'consider'
}

interface RecommendationResponse {
  driver_id: string
  driver_name: string
  best_match: LoadRecommendation | null
  good_matches: LoadRecommendation[]
  consider: LoadRecommendation[]
  total_available: number
  personalized_insights: string[]
}

export default function BenjiLoadRecommendations() {
  const { profile } = useAuth()
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedLoad, setExpandedLoad] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.id) {
      loadRecommendations()
    }
  }, [profile?.id])

  const loadRecommendations = async () => {
    if (!profile?.id) return

    setIsLoading(true)
    try {
      // Get auth token from Supabase session
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      console.log('🔐 Auth Debug:', {
        hasSession: !!session,
        hasToken: !!session?.access_token,
        tokenPreview: session?.access_token ? `${session.access_token.substring(0, 30)}...` : 'none',
        profileId: profile.id,
        userId: session?.user?.id
      })
      
      if (!session?.access_token) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(
        `https://drivedrop-main-production.up.railway.app/api/v1/ai/loads/recommendations/${profile.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (!response.ok) throw new Error('Failed to load recommendations')

      const data = await response.json()
      setRecommendations(data.recommendations)
    } catch (error) {
      console.error('Recommendations error:', error)
      toast.error('Failed to load recommendations')
    } finally {
      setIsLoading(false)
    }
  }

  const acceptLoad = async (loadId: string) => {
    try {
      // TODO: Implement load acceptance
      toast.success('Load accepted! Check your active shipments.')
      
      // Refresh recommendations
      setTimeout(() => loadRecommendations(), 1000)
    } catch (error) {
      toast.error('Failed to accept load')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">Benji is finding perfect loads for you...</p>
          <p className="text-sm text-gray-500 mt-2">Analyzing routes, earnings, and timing</p>
        </div>
      </div>
    )
  }

  if (!recommendations) {
    return (
      <div className="text-center py-12">
        <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No recommendations available</p>
        <Button onClick={loadRecommendations} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  const renderLoadCard = (rec: LoadRecommendation, index: number, priority: 'best' | 'good' | 'consider') => {
    const isExpanded = expandedLoad === rec.load.id
    const priorityStyles = {
      best: 'border-green-500 bg-gradient-to-br from-green-50 to-teal-50',
      good: 'border-teal-300 bg-white',
      consider: 'border-gray-300 bg-white'
    }

    const priorityBadge = {
      best: { bg: 'bg-green-500', text: 'Best Match', icon: '⭐' },
      good: { bg: 'bg-teal-500', text: 'Good Match', icon: '✅' },
      consider: { bg: 'bg-gray-500', text: 'Consider', icon: '💡' }
    }

    return (
      <div
        key={rec.load.id}
        className={`border-2 rounded-xl p-6 transition-all ${priorityStyles[priority]} ${
          isExpanded ? 'shadow-lg' : 'shadow-md hover:shadow-lg'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {priority === 'best' && (
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 text-white font-bold">
                  {index + 1}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-3 py-1 ${priorityBadge[priority].bg} text-white text-xs font-bold rounded-full`}>
                    {priorityBadge[priority].icon} {priorityBadge[priority].text}
                  </span>
                  <span className="px-2 py-1 bg-white border border-gray-300 text-gray-800 text-xs font-medium rounded">
                    {rec.match_score}% Match
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Load #{rec.load.id.slice(0, 8)} · Posted {new Date(rec.load.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Earnings Badge */}
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              ${rec.estimated_earnings}
            </div>
            <div className="text-xs text-gray-600">You earn</div>
          </div>
        </div>

        {/* Vehicle Info */}
        {rec.load.vehicle_make && (
          <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-900">
              🚗 {rec.load.vehicle_year} {rec.load.vehicle_make} {rec.load.vehicle_model}
            </div>
          </div>
        )}

        {/* Route */}
        <div className="mb-4 space-y-2">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Pickup</div>
              <div className="text-sm text-gray-600">{rec.load.pickup_address}</div>
              <div className="text-xs text-teal-600 mt-1">
                📍 {rec.distance_to_pickup} miles from your location
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Navigation className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Delivery</div>
              <div className="text-sm text-gray-600">{rec.load.delivery_address}</div>
              <div className="text-xs text-gray-600 mt-1">
                📏 {(rec.load.estimated_distance_km * 0.621371).toFixed(0)} miles · 
                ${(rec.load.estimated_price / (rec.load.estimated_distance_km * 0.621371)).toFixed(2)}/mi
              </div>
            </div>
          </div>
        </div>

        {/* Why Perfect For You */}
        <div className="mb-4">
          <div className="text-sm font-semibold text-gray-900 mb-2">
            💡 Why this is {priority === 'best' ? 'perfect' : priority === 'good' ? 'great' : 'worth considering'} for you:
          </div>
          <div className="space-y-1">
            {rec.reasons.map((reason, i) => (
              <div key={i} className="text-sm text-gray-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-teal-600 flex-shrink-0" />
                {reason}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={() => acceptLoad(rec.load.id)}
            className="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white"
          >
            <Zap className="mr-2 h-4 w-4" />
            Accept Load
          </Button>
          <Button
            variant="outline"
            onClick={() => setExpandedLoad(isExpanded ? null : rec.load.id)}
          >
            {isExpanded ? 'Less' : 'More'} Details
          </Button>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-600">Route Fit</div>
                <div className="text-sm font-semibold">{rec.route_fit}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Confidence</div>
                <div className="text-sm font-semibold">{rec.confidence}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Distance</div>
                <div className="text-sm font-semibold">{(rec.load.estimated_distance_km * 0.621371).toFixed(0)} mi</div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-8 w-8" />
              <h2 className="text-2xl font-bold">Benji's Recommendations</h2>
            </div>
            <p className="text-teal-100">
              AI-powered load matching just for you
            </p>
          </div>
          <Button
            onClick={loadRecommendations}
            disabled={isLoading}
            variant="outline"
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-3">
            <div className="text-teal-200 text-xs font-medium">Available Loads</div>
            <div className="text-2xl font-bold">{recommendations.total_available}</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-3">
            <div className="text-teal-200 text-xs font-medium">Top Match</div>
            <div className="text-2xl font-bold">
              {recommendations.best_match ? `${recommendations.best_match.match_score}%` : 'N/A'}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-3">
            <div className="text-teal-200 text-xs font-medium">Potential Earnings</div>
            <div className="text-2xl font-bold">
              $
              {([recommendations.best_match, ...recommendations.good_matches]
                .filter(Boolean)
                .reduce((sum, r) => sum + (r?.estimated_earnings || 0), 0) / 1000).toFixed(1)}k
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      {recommendations.personalized_insights.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">Benji's Insights</h3>
              <div className="space-y-1">
                {recommendations.personalized_insights.map((insight, i) => (
                  <div key={i} className="text-sm text-blue-800">
                    • {insight}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Best Match */}
      {recommendations.best_match && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            Perfect Match For You
          </h3>
          {renderLoadCard(recommendations.best_match, 0, 'best')}
        </div>
      )}

      {/* Good Matches */}
      {recommendations.good_matches.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Also Great ({recommendations.good_matches.length})
          </h3>
          <div className="space-y-4">
            {recommendations.good_matches.map((rec, idx) => renderLoadCard(rec, idx, 'good'))}
          </div>
        </div>
      )}

      {/* Consider */}
      {recommendations.consider.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Worth Considering ({recommendations.consider.length})
          </h3>
          <div className="space-y-4">
            {recommendations.consider.map((rec, idx) => renderLoadCard(rec, idx, 'consider'))}
          </div>
        </div>
      )}

      {/* No Recommendations */}
      {!recommendations.best_match && 
       recommendations.good_matches.length === 0 && 
       recommendations.consider.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900">No loads available right now</p>
          <p className="text-gray-600 mt-2">Check back soon for new opportunities!</p>
          <Button onClick={loadRecommendations} className="mt-4">
            Check Again
          </Button>
        </div>
      )}
    </div>
  )
}
