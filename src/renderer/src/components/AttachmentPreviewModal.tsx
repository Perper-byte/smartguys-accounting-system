// src/renderer/src/components/AttachmentPreviewModal.tsx
import * as React from 'react'
import { useEffect } from 'react'
import { X, Download, Image as ImageIcon, FileText } from 'lucide-react'

export interface AttachmentPreviewItem {
  name: string
  data: string
  type?: string
  size?: number
}

interface AttachmentPreviewModalProps {
  attachment: AttachmentPreviewItem | null
  onClose: () => void
}

export function AttachmentPreviewModal({ attachment, onClose }: AttachmentPreviewModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!attachment) return null

  const isImage =
    (attachment.type && attachment.type.includes('image')) ||
    attachment.data?.startsWith('data:image') ||
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(attachment.name || '')

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const link = document.createElement('a')
      link.href = attachment.data
      link.download = attachment.name || 'attachment'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
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
              title={attachment.name}
            >
              {attachment.name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B9387] hover:bg-[#15796f] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Download attachment to PC"
            >
              <Download size={14} />
              <span>Download</span>
            </button>
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
        <div className="p-4 flex items-center justify-center overflow-auto bg-gray-900/5 flex-1 min-h-[350px]">
          {isImage ? (
            <img
              src={attachment.data}
              alt={attachment.name}
              className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-sm select-none"
            />
          ) : (
            <iframe
              src={attachment.data}
              title={attachment.name}
              className="w-full h-[72vh] border-0 rounded-lg bg-white shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  )
}
