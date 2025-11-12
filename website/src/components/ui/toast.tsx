'use client'

import { useEffect, useState } from 'react'
import { Check, X, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

let addToastFn: ((message: string, type: ToastType) => void) | null = null

export function toast(message: string, type: ToastType = 'info') {
  if (addToastFn) {
    addToastFn(message, type)
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    addToastFn = (message: string, type: ToastType) => {
      const id = Math.random().toString(36).substr(2, 9)
      setToasts(prev => [...prev, { id, message, type }])
      
      // Auto remove after 3 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 3000)
    }

    return () => {
      addToastFn = null
    }
  }, [])

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <Check className="h-5 w-5" />
      case 'error':
        return <X className="h-5 w-5" />
      case 'warning':
        return <AlertCircle className="h-5 w-5" />
      case 'info':
        return <Info className="h-5 w-5" />
    }
  }

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 text-green-900 border-green-200'
      case 'error':
        return 'bg-red-50 text-red-900 border-red-200'
      case 'warning':
        return 'bg-yellow-50 text-yellow-900 border-yellow-200'
      case 'info':
        return 'bg-blue-50 text-blue-900 border-blue-200'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-down ${getStyles(toast.type)}`}
        >
          {getIcon(toast.type)}
          <p className="font-medium">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 hover:opacity-70 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
