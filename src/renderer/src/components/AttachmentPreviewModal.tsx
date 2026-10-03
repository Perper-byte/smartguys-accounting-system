// src/renderer/src/components/AttachmentPreviewModal.tsx
import * as React from 'react'
import { useEffect, useState, useMemo } from 'react'
import {
  X,
  Download,
  Image as ImageIcon,
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

export interface AttachmentPreviewItem {
  id?: string
  name: string
  data: string
  type?: string
  size?: number
  entryId?: string
}

interface AttachmentPreviewModalProps {
  attachment?: AttachmentPreviewItem | null
  attachments?: AttachmentPreviewItem[]
  initialIndex?: number
  onClose: () => void
  onAttachmentUpdated?: (newAttachment: AttachmentPreviewItem) => void
}

export function AttachmentPreviewModal({
  attachment: initialAttachment,
  attachments: initialAttachments,
  initialIndex = 0,
  onClose,
  onAttachmentUpdated
}: AttachmentPreviewModalProps) {
  const allItems: AttachmentPreviewItem[] = useMemo(() => {
    if (initialAttachments && initialAttachments.length > 0) {
      return initialAttachments
    }
    if (initialAttachment) {
      return [initialAttachment]
    }
    return []
  }, [initialAttachments, initialAttachment])

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [currentAttachment, setCurrentAttachment] = useState<AttachmentPreviewItem | null>(
    allItems[initialIndex] || allItems[0] || null
  )
  const [imageError, setImageError] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [replaceSuccess, setReplaceSuccess] = useState(false)

  useEffect(() => {
    const idx = Math.min(Math.max(0, initialIndex), Math.max(0, allItems.length - 1))
    setCurrentIndex(idx)
    setCurrentAttachment(allItems[idx] || null)
    setImageError(false)
    setReplaceSuccess(false)
  }, [allItems, initialIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && allItems.length > 1) {
        setCurrentIndex((prev) => {
          const next = prev > 0 ? prev - 1 : allItems.length - 1
          setCurrentAttachment(allItems[next])
          setImageError(false)
          return next
        })
      }
      if (e.key === 'ArrowRight' && allItems.length > 1) {
        setCurrentIndex((prev) => {
          const next = prev < allItems.length - 1 ? prev + 1 : 0
          setCurrentAttachment(allItems[next])
          setImageError(false)
          return next
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, allItems])

  if (!currentAttachment) return null

  const isImage =
    (currentAttachment.type && currentAttachment.type.includes('image')) ||
    currentAttachment.data?.startsWith('data:image') ||
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(currentAttachment.name || '')

  const mime = (() => {
    if (currentAttachment.type && currentAttachment.type.trim()) return currentAttachment.type.trim()
    const ext = currentAttachment.name?.split('.').pop()?.toLowerCase()
    if (ext === 'png') return 'image/png'
    if (ext === 'webp') return 'image/webp'
    if (ext === 'gif') return 'image/gif'
    if (ext === 'pdf') return 'application/pdf'
    return 'image/jpeg'
  })()

  const normalizedSrc = (() => {
    if (!currentAttachment.data) return ''
    const trimmed = currentAttachment.data.trim()
    if (trimmed.startsWith('data:')) return trimmed
    return `data:${mime};base64,${trimmed}`
  })()

  // Earlier uploads were truncated to 191 chars in MySQL before the LONGTEXT fix
  const isCorruptedOrTruncated =
    isImage && (!currentAttachment.data || currentAttachment.data.length <= 250 || imageError)

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const link = document.createElement('a')
      link.href = normalizedSrc
      link.download = currentAttachment.name || 'attachment'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const handleFileReplacement = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setReplacing(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64Data = event.target?.result
      const updatedItem = {
        ...currentAttachment,
        name: file.name,
        type: file.type || 'image/jpeg',
        data: base64Data
      }

      if (currentAttachment.entryId) {
        try {
          const api = window.api || window.electronAPI
          if (api?.updateDisbursementAttachment) {
            await api.updateDisbursementAttachment(currentAttachment.entryId, {
              name: file.name,
              type: file.type || 'image/jpeg',
              data: base64Data
            })
          }
        } catch (err) {
          console.error('Failed to update attachment in database:', err)
        }
      }

      setCurrentAttachment(updatedItem)
      setImageError(false)
      setReplacing(false)
      setReplaceSuccess(true)
      onAttachmentUpdated?.(updatedItem)
    }
    reader.readAsDataURL(file)
  }

  const goToPrev = () => {
    if (allItems.length <= 1) return
    const next = currentIndex > 0 ? currentIndex - 1 : allItems.length - 1
    setCurrentIndex(next)
    setCurrentAttachment(allItems[next])
    setImageError(false)
  }

  const goToNext = () => {
    if (allItems.length <= 1) return
    const next = currentIndex < allItems.length - 1 ? currentIndex + 1 : 0
    setCurrentIndex(next)
    setCurrentAttachment(allItems[next])
    setImageError(false)
  }

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-[#FBF8F8]">
          <div className="flex items-center gap-2 overflow-hidden pr-4">
            {isImage ? (
              <ImageIcon className="w-5 h-5 text-[#1B9387] shrink-0" />
            ) : (
              <FileText className="w-5 h-5 text-[#1B9387] shrink-0" />
            )}
            <span
              className="font-black text-gray-800 text-sm truncate select-all"
              title={currentAttachment.name}
            >
              {currentAttachment.name}
            </span>
            {allItems.length > 1 && (
              <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full shrink-0">
                {currentIndex + 1} of {allItems.length}
              </span>
            )}
            {replaceSuccess && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                <CheckCircle size={12} /> Replaced!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentAttachment.entryId && (
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition cursor-pointer">
                <Upload size={13} />
                <span>{replacing ? 'Uploading...' : 'Replace Photo'}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileReplacement}
                  disabled={replacing}
                />
              </label>
            )}

            {!isCorruptedOrTruncated && (
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B9387] hover:bg-[#15796f] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Download attachment to PC"
              >
                <Download size={14} />
                <span>Download</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PREVIEW CONTENT */}
        <div className="p-4 flex items-center justify-center overflow-auto bg-gray-900/5 flex-1 min-h-[350px] relative">
          {allItems.length > 1 && (
            <>
              <button
                type="button"
                onClick={goToPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white text-gray-700 shadow-md rounded-full transition z-10 cursor-pointer"
                title="Previous attachment (Left Arrow)"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white text-gray-700 shadow-md rounded-full transition z-10 cursor-pointer"
                title="Next attachment (Right Arrow)"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {isCorruptedOrTruncated ? (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md bg-white rounded-2xl shadow-sm border border-amber-200">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-3 border border-amber-200">
                <AlertTriangle size={24} />
              </div>
              <h4 className="font-extrabold text-sm text-gray-800 mb-1">
                Receipt Photo Incomplete (Truncated)
              </h4>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                This receipt was saved prior to the database capacity fix (image was cut off at 191 characters).
                The database has now been upgraded to full{' '}
                <code className="text-gray-700 font-mono font-bold">LONGTEXT</code> support.
              </p>
              {currentAttachment.entryId ? (
                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1B9387] hover:bg-[#15796f] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl cursor-pointer transition shadow-sm">
                  <Upload size={14} />
                  <span>{replacing ? 'Uploading...' : 'Upload Replacement Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileReplacement}
                    disabled={replacing}
                  />
                </label>
              ) : (
                <p className="text-[11px] text-gray-400 italic">
                  New vouchers uploaded from now on will save in full quality.
                </p>
              )}
            </div>
          ) : isImage ? (
            <img
              src={normalizedSrc}
              alt={currentAttachment.name}
              onError={() => setImageError(true)}
              className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-sm select-none"
            />
          ) : (
            <iframe
              src={normalizedSrc}
              title={currentAttachment.name}
              className="w-full h-[72vh] border-0 rounded-lg bg-white shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  )
}
