'use client'

import { useEffect, useRef, useState } from 'react'
import { compressImage } from '@/lib/image-compress'
import { X } from '@/components/icons/streamline-lucide'

export interface ProofData {
  photos: File[]
  signature: Blob | null
  receiverName: string
  notes: string
}

interface Props {
  kind: 'pickup' | 'delivery' | 'stop'
  title: string
  customerName?: string | undefined
  onSubmit: (data: ProofData) => Promise<void>
  onSkip: () => void
  onClose: () => void
}

const MAX_PHOTOS = 6

function SignaturePad({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [signed, setSigned] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * ratio
    canvas.height = canvas.clientHeight * ratio
    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(ratio, ratio)
    context.lineWidth = 2.5
    context.lineCap = 'round'
    context.strokeStyle = '#111827'
  }, [])

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext('2d')
    if (!context) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    const { x, y } = point(event)
    context.beginPath()
    context.moveTo(x, y)
  }

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const context = event.currentTarget.getContext('2d')
    if (!context) return
    const { x, y } = point(event)
    context.lineTo(x, y)
    context.stroke()
  }

  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    drawing.current = false
    setSigned(true)
    event.currentTarget.toBlob(blob => onChange(blob), 'image/png')
  }

  const clear = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.save()
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.restore()
    setSigned(false)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Signature"
        className="h-32 w-full touch-none rounded-md border border-dashed border-gray-400 bg-white"
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
        <span>{signed ? 'Signature captured' : 'Sign above with a finger or stylus'}</span>
        <button type="button" onClick={clear} disabled={!signed} className="font-semibold text-gray-700 disabled:opacity-40">Clear</button>
      </div>
    </div>
  )
}

// Photos, a signature and notes saved with the stop; the driver can always skip it.
export default function ProofSheet({ kind, title, customerName, onSubmit, onSkip, onClose }: Props) {
  const [photos, setPhotos] = useState<Array<{ file: File; url: string }>>([])
  const [signature, setSignature] = useState<Blob | null>(null)
  const [showSignature, setShowSignature] = useState(kind === 'delivery')
  const [receiverName, setReceiverName] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const urlsRef = useRef<string[]>([])

  useEffect(() => () => urlsRef.current.forEach(url => URL.revokeObjectURL(url)), [])

  const addFiles = async (list: FileList | null) => {
    if (!list) return
    const room = MAX_PHOTOS - photos.length
    const compressed = await Promise.all(Array.from(list).slice(0, room).map(file => compressImage(file)))
    const added = compressed.map(file => {
      const url = URL.createObjectURL(file)
      urlsRef.current.push(url)
      return { file, url }
    })
    setPhotos(current => [...current, ...added])
  }

  const hasContent = photos.length > 0 || signature !== null || receiverName.trim() !== '' || notes.trim() !== ''

  const submit = async () => {
    if (!hasContent) {
      onSkip()
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit({ photos: photos.map(item => item.file), signature, receiverName, notes })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the proof')
    } finally {
      setBusy(false)
    }
  }

  const heading = kind === 'pickup' ? 'Pickup photos' : kind === 'delivery' ? 'Proof of delivery' : 'Proof for this stop'
  const field = 'h-11 w-full rounded-md border border-gray-300 px-3 text-sm'

  return (
    <div role="dialog" aria-label={heading} className="mb-2 max-h-[75vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">{heading}</p>
          <p className="truncate text-xs text-gray-600">{title}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Back" className="grid h-8 w-8 shrink-0 place-items-center text-gray-500"><X className="h-4 w-4" /></button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {photos.map((item, index) => (
          <div key={item.url} className="relative h-20 w-20 overflow-hidden rounded-md border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
            <button type="button" onClick={() => setPhotos(current => current.filter(photo => photo.url !== item.url))} aria-label={`Remove photo ${index + 1}`} className="absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"><X className="h-3 w-3" /></button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-md border border-dashed border-gray-400 text-center text-[11px] font-semibold text-gray-700">
            <span>Add photo</span>
            <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={event => { void addFiles(event.target.files); event.target.value = '' }} />
          </label>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <input value={receiverName} onChange={event => setReceiverName(event.target.value)} maxLength={120} placeholder={customerName ? `Received by (${customerName})` : 'Received by'} aria-label="Received by" className={field} />
        {showSignature
          ? <SignaturePad onChange={setSignature} />
          : <button type="button" onClick={() => setShowSignature(true)} className="h-10 w-full rounded-md border border-gray-300 text-xs font-semibold text-gray-700">Add a signature</button>}
        <textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} placeholder="Notes (condition, damage, where it was left)" aria-label="Notes" className="min-h-16 w-full rounded-md border border-gray-300 p-3 text-sm" />
      </div>

      {error && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onSkip} disabled={busy} className="h-11 flex-1 rounded-md border border-gray-300 text-sm font-semibold text-gray-700 disabled:opacity-50">{error ? 'Complete without proof' : 'Skip proof'}</button>
        <button type="button" onClick={() => void submit()} disabled={busy} className="h-11 flex-1 rounded-md bg-green-600 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving...' : hasContent ? 'Save and complete' : 'Complete'}</button>
      </div>
    </div>
  )
}
