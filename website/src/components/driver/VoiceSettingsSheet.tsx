'use client'

import { useEffect, useState } from 'react'
import { NATURAL_VOICE_OPTIONS, deviceVoices, guessVoiceGender, pickDeviceVoice, type NaturalVoiceState, type VoiceSettings } from '@/lib/voice'
import { formatUsd, summarizeCost, type BenjiCost } from '@/lib/benji-cost'
import { X } from '@/components/icons/streamline-lucide'

interface Props {
  settings: VoiceSettings
  naturalState: NaturalVoiceState
  cost?: BenjiCost
  onChange: (settings: VoiceSettings) => void
  onTest: () => void
  onClose: () => void
}

export default function VoiceSettingsSheet({ settings, naturalState, cost, onChange, onTest, onClose }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    const load = () => setVoices(deviceVoices())
    load()
    window.speechSynthesis?.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load)
  }, [])

  const choice = (active: boolean, disabled = false) => `flex min-h-11 flex-1 items-center justify-center rounded-md border px-3 text-xs font-semibold ${disabled ? 'border-gray-200 text-gray-400' : active ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-300 text-gray-700'}`
  const naturalOff = naturalState === 'unavailable'
  const usingDevice = settings.engine === 'device' || naturalOff
  const activeGender = guessVoiceGender(settings.deviceVoice)
  const maleVoice = pickDeviceVoice(voices, 'male')
  const femaleVoice = pickDeviceVoice(voices, 'female')

  return (
    <div role="dialog" aria-label="Benji's voice" className="mb-2 max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900">Benji&apos;s voice</p>
          <p className="text-xs text-gray-600">Saved on this device.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center text-gray-500"><X className="h-4 w-4" /></button>
      </div>

      <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-md border border-gray-200 px-3 text-sm font-semibold text-gray-800">
        Spoken directions
        <input type="checkbox" role="switch" checked={!settings.muted} onChange={event => onChange({ ...settings, muted: !event.target.checked })} className="h-5 w-5 accent-amber-500" />
      </label>

      <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Voice type">
        <button type="button" role="radio" aria-checked={settings.engine === 'natural'} onClick={() => onChange({ ...settings, engine: 'natural' })} className={choice(settings.engine === 'natural')}>Natural voice</button>
        <button type="button" role="radio" aria-checked={settings.engine === 'device'} onClick={() => onChange({ ...settings, engine: 'device' })} className={choice(settings.engine === 'device')}>This device</button>
      </div>
      <p className={`mt-1 text-[11px] ${naturalOff && settings.engine === 'natural' ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>
        {settings.engine === 'natural'
          ? naturalOff
            ? 'Natural voices are not switched on for this server yet, so your device voice is speaking for now.'
            : 'A clearer, more human voice that needs a data connection. If it is slow or offline, your device voice speaks instead.'
          : 'Works offline. How it sounds depends on your phone.'}
      </p>

      {!usingDevice ? (
        <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Natural voice">
          {NATURAL_VOICE_OPTIONS.map(option => (
            <button key={option.id} type="button" role="radio" aria-checked={settings.voice === option.id} onClick={() => onChange({ ...settings, voice: option.id })} className={choice(settings.voice === option.id)}>{option.label}</button>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Voice gender">
            <button type="button" role="radio" aria-checked={activeGender === 'female'} disabled={!femaleVoice} onClick={() => onChange({ ...settings, deviceVoice: femaleVoice })} className={choice(activeGender === 'female', !femaleVoice)}>Female</button>
            <button type="button" role="radio" aria-checked={activeGender === 'male'} disabled={!maleVoice} onClick={() => onChange({ ...settings, deviceVoice: maleVoice })} className={choice(activeGender === 'male', !maleVoice)}>Male</button>
          </div>
          <label className="mt-2 block text-xs font-semibold text-gray-700">Device voice
            <select value={settings.deviceVoice} onChange={event => onChange({ ...settings, deviceVoice: event.target.value })} className="mt-1 h-11 w-full rounded-md border border-gray-300 bg-white px-2 text-sm">
              <option value="">Automatic</option>
              {voices.map(voice => {
                const gender = guessVoiceGender(voice.name)
                return <option key={voice.name} value={voice.name}>{voice.name}{gender === 'unknown' ? '' : ` (${gender})`}</option>
              })}
            </select>
          </label>
          {voices.length === 0 && <p className="mt-1 text-[11px] text-gray-500">This device has not listed any English voices yet.</p>}
        </div>
      )}

      <label className="mt-3 block text-xs font-semibold text-gray-700">Speed {settings.rate.toFixed(2)}x
        <input type="range" min={0.8} max={1.3} step={0.05} value={settings.rate} onChange={event => onChange({ ...settings, rate: Number(event.target.value) })} className="mt-1 w-full accent-amber-500" />
      </label>
      <label className="mt-2 block text-xs font-semibold text-gray-700">Volume {Math.round(settings.volume * 100)}%
        <input type="range" min={0.2} max={1} step={0.1} value={settings.volume} onChange={event => onChange({ ...settings, volume: Number(event.target.value) })} className="mt-1 w-full accent-amber-500" />
      </label>

      <button type="button" onClick={onTest} className="mt-3 h-11 w-full rounded-md bg-gray-900 text-sm font-bold text-white">Hear Benji</button>
      <p className="mt-1 text-[11px] text-gray-500">No sound? Turn up your phone&apos;s media volume and take it off silent.</p>
      {cost && (() => {
        const summary = summarizeCost(cost)
        return (
          <p className="mt-2 rounded-md bg-gray-50 px-2.5 py-2 text-[11px] text-gray-600">
            Benji today: {cost.questions} question{cost.questions === 1 ? '' : 's'}, about {formatUsd(summary.totalUsd)} (talking {formatUsd(summary.ttsUsd)}, thinking {formatUsd(summary.llmUsd)}). An estimate before Google&apos;s free monthly voice allowance. Listening to you is free.
          </p>
        )
      })()}
    </div>
  )
}
