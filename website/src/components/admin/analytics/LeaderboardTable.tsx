'use client'

import { LeaderboardEntry } from '@/types/campaigns'
import Link from 'next/link'
import { Trophy } from 'lucide-react'

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  loading?: boolean
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function LeaderboardTable({ entries, loading }: LeaderboardTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!entries.length) {
    return (
      <div className="py-10 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
        <Trophy className="h-8 w-8 text-gray-200" />
        No campaign data yet
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">#</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Campaign</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Sent</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Open Rate</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Click Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {entries.map((e, i) => (
            <tr key={e.campaignId} className="hover:bg-gray-50 transition-colors">
              <td className="py-2.5 px-3 text-center">
                {i < 3 ? MEDALS[i] : <span className="text-gray-400 text-xs font-medium">{i + 1}</span>}
              </td>
              <td className="py-2.5 px-3">
                <Link
                  href={`/dashboard/admin/campaigns/${e.campaignId}`}
                  className="font-medium text-gray-800 hover:text-[#00B8A9] transition-colors line-clamp-1"
                >
                  {e.campaignName}
                </Link>
              </td>
              <td className="py-2.5 px-3 text-right text-gray-600">{e.sent.toLocaleString()}</td>
              <td className="py-2.5 px-3 text-right">
                <span className={`font-semibold ${e.openRate >= 20 ? 'text-green-600' : e.openRate >= 10 ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {e.openRate.toFixed(1)}%
                </span>
              </td>
              <td className="py-2.5 px-3 text-right">
                <span className={`font-semibold ${e.clickRate >= 5 ? 'text-green-600' : e.clickRate >= 2 ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {e.clickRate.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
