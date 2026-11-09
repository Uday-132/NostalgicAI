import { useState } from 'react'

export interface ConvertOption {
  format: string
  label: string
  icon: string
  extension: string
  description: string
}

// Pure browser-compatible format determination
export function getAvailableConvertOptions(filePath: string): ConvertOption[] {
  const fileName = filePath.split(/[/\\]/).pop() || ''
  const ext = (fileName.split('.').pop() || '').toLowerCase()

  const allOptions: Record<string, ConvertOption> = {
    // PDF Conversions & Tools (iLovePDF full suite)
    word: { format: 'word', label: 'PDF to Word', icon: '📝', extension: '.docx', description: 'Exact layout via pdf2docx' },
    ppt: { format: 'ppt', label: 'PDF to PPT', icon: '📊', extension: '.pptx', description: 'Convert PDF pages to slides' },
    excel: { format: 'excel', label: 'PDF to Excel', icon: '📈', extension: '.xlsx', description: 'Extract tables to spreadsheet' },
    jpg: { format: 'jpg', label: 'PDF to JPG', icon: '🖼️', extension: '.jpg', description: 'Extract pages as JPG images' },
    split: { format: 'split', label: 'Split PDF', icon: '✂️', extension: '.pdf', description: 'Split into separate page PDFs' },
    compress: { format: 'compress', label: 'Compress PDF', icon: '🗜️', extension: '.pdf', description: 'Reduce PDF file size' },
    pdfa: { format: 'pdfa', label: 'PDF to PDF/A', icon: '🏛️', extension: '.pdf', description: 'Archival ISO compliant format' },

    // Convert to PDF
    pdf: { format: 'pdf', label: 'Convert to PDF', icon: '📄', extension: '.pdf', description: 'Native vector PDF export' },
    txt: { format: 'txt', label: 'Text (.txt)', icon: '📋', extension: '.txt', description: 'Plain text document' },
    html: { format: 'html', label: 'Web (.html)', icon: '🌐', extension: '.html', description: 'HTML document' },
    md: { format: 'md', label: 'Markdown (.md)', icon: '📑', extension: '.md', description: 'Markdown formatted file' },
  }

  // If input is PDF: provide all 7 core iLovePDF features!
  if (ext === 'pdf') {
    return [
      allOptions.word,
      allOptions.ppt,
      allOptions.excel,
      allOptions.jpg,
      allOptions.split,
      allOptions.compress,
      allOptions.pdfa
    ]
  }

  // If input is PowerPoint (ppt, pptx)
  if (['ppt', 'pptx'].includes(ext)) {
    return [allOptions.pdf, allOptions.word, allOptions.txt, allOptions.html]
  }

  // If input is Word (doc, docx)
  if (['doc', 'docx'].includes(ext)) {
    return [allOptions.pdf, allOptions.txt, allOptions.html, allOptions.md]
  }

  // If input is Excel (xls, xlsx, csv)
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return [allOptions.pdf, allOptions.txt]
  }

  // If input is Image (jpg, jpeg, png, webp, bmp)
  if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) {
    return [allOptions.pdf, allOptions.word]
  }

  // If input is HTML
  if (['html', 'htm'].includes(ext)) {
    return [allOptions.pdf, allOptions.word, allOptions.txt]
  }

  // If input is Text or Markdown
  if (['txt', 'md', 'markdown'].includes(ext)) {
    return [allOptions.pdf, allOptions.word, allOptions.html]
  }

  return [allOptions.pdf, allOptions.word, allOptions.txt]
}

interface RadialMenuProps {
  filePath: string
  fileName?: string
  position?: { x: number; y: number }
  onClose: () => void
  onConvertSuccess?: (outputPath: string) => void
}

export function RadialMenu({ filePath, fileName, position, onClose, onConvertSuccess }: RadialMenuProps) {
  const [isConverting, setIsConverting] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [convertedPath, setConvertedPath] = useState<string | null>(null)

  const name = fileName || filePath.split(/[/\\]/).pop() || 'Selected Document'
  const ext = (name.split('.').pop() || '').toLowerCase()
  const options: ConvertOption[] = getAvailableConvertOptions(filePath)

  const handleSelectOption = async (option: ConvertOption) => {
    if (isConverting) return
    setIsConverting(true)
    setSelectedFormat(option.format)
    setStatusMessage(`Converting to ${option.label}...`)

    try {
      if (window.ipcRenderer) {
        const result = await window.ipcRenderer.invoke('convert-file', {
          filePath,
          targetFormat: option.format
        })

        if (result.success) {
          setStatusMessage(`Converted to ${option.label}! Saved in same folder.`)
          setConvertedPath(result.outputPath)
          if (onConvertSuccess) onConvertSuccess(result.outputPath)
        } else {
          setStatusMessage(`Error: ${result.error || 'Conversion failed'}`)
        }
      } else {
        // Fallback demo in browser
        setTimeout(() => {
          setStatusMessage(`[Demo] Converted ${name} to ${option.format.toUpperCase()} in place`)
          setConvertedPath(filePath.replace(/\.[^/.]+$/, option.extension))
        }, 1200)
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`)
    } finally {
      setIsConverting(false)
    }
  }

  const handleOpenFolder = () => {
    if (convertedPath && window.ipcRenderer) {
      window.ipcRenderer.invoke('show-in-folder', convertedPath)
    }
  }

  const count = options.length
  const radius = 135

  // Calculate position: center on click point if provided
  const wheelX = position ? Math.max(20, Math.min(window.innerWidth - 380, position.x - 180)) : undefined
  const wheelY = position ? Math.max(20, Math.min(window.innerHeight - 380, position.y - 180)) : undefined

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute',
          left: wheelX !== undefined ? `${wheelX}px` : 'calc(50% - 180px)',
          top: wheelY !== undefined ? `${wheelY}px` : 'calc(50% - 180px)',
          width: '360px',
          height: '360px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Outer Circular Track */}
        <div
          style={{
            position: 'absolute',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            border: '2px dashed rgba(0, 243, 255, 0.4)',
            boxShadow: '0 0 40px rgba(0, 243, 255, 0.18)',
            pointerEvents: 'none',
            animation: isConverting ? 'spin 3s linear infinite' : 'none'
          }}
        />

        {/* Center Node: Target File */}
        <div
          style={{
            width: '146px',
            height: '146px',
            borderRadius: '50%',
            backgroundColor: '#16171f',
            border: '2px solid #00f3ff',
            boxShadow: '0 0 30px rgba(0, 243, 255, 0.5), inset 0 0 20px rgba(0, 0, 0, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            padding: '12px',
            textAlign: 'center',
            color: '#fff',
            cursor: 'default'
          }}
        >
          <span style={{ fontSize: '2rem', marginBottom: '2px' }}>
            {['ppt', 'pptx'].includes(ext) ? '📊' : ['doc', 'docx'].includes(ext) ? '📝' : ext === 'pdf' ? '📄' : '📁'}
          </span>
          <div
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              maxWidth: '115px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: '#00f3ff'
            }}
            title={name}
          >
            {name}
          </div>
          <span
            style={{
              fontSize: '0.62rem',
              color: '#8e92a4',
              marginTop: '2px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600
            }}
          >
            {ext ? `${ext.toUpperCase()} FILE` : 'FILE'}
          </span>

          {isConverting ? (
            <div style={{ fontSize: '0.62rem', color: '#ff00ff', marginTop: '4px', fontWeight: 'bold' }}>
              CONVERTING...
            </div>
          ) : (
            <div style={{ fontSize: '0.58rem', color: '#686b78', marginTop: '2px' }}>
              Select target format
            </div>
          )}
        </div>

        {/* Circular Menu Options around the center file */}
        {options.map((opt, i) => {
          const angle = (2 * Math.PI / count) * i - Math.PI / 2
          const x = Math.round(radius * Math.cos(angle))
          const y = Math.round(radius * Math.sin(angle))
          const isSelected = selectedFormat === opt.format

          return (
            <button
              key={opt.format}
              onClick={() => handleSelectOption(opt)}
              disabled={isConverting}
              style={{
                position: 'absolute',
                transform: `translate(${x}px, ${y}px)`,
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                backgroundColor: isSelected ? '#00f3ff' : '#1e1f28',
                color: isSelected ? '#0b0c10' : '#ffffff',
                border: isSelected ? '2px solid #ffffff' : '2px solid rgba(0, 243, 255, 0.3)',
                boxShadow: isSelected
                  ? '0 0 25px #00f3ff'
                  : '0 6px 20px rgba(0, 0, 0, 0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isConverting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                zIndex: 20
              }}
              onMouseEnter={(e) => {
                if (!isConverting) {
                  e.currentTarget.style.transform = `translate(${x}px, ${y}px) scale(1.15)`
                  e.currentTarget.style.borderColor = '#00f3ff'
                  e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 243, 255, 0.6)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isConverting) {
                  e.currentTarget.style.transform = `translate(${x}px, ${y}px) scale(1)`
                  e.currentTarget.style.borderColor = isSelected ? '#ffffff' : 'rgba(0, 243, 255, 0.3)'
                  e.currentTarget.style.boxShadow = isSelected ? '0 0 25px #00f3ff' : '0 6px 20px rgba(0, 0, 0, 0.7)'
                }
              }}
            >
              <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{opt.icon}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, marginTop: '3px' }}>
                {opt.format.toUpperCase()}
              </span>
            </button>
          )
        })}

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '-10px',
            right: '-10px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#2b2c36',
            color: '#a0a3b2',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            zIndex: 30
          }}
          title="Close Radial Menu (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Floating Status Notification */}
      {statusMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1b1c23',
            border: '1px solid #00f3ff',
            borderRadius: '12px',
            padding: '12px 24px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 243, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            color: '#fff',
            fontSize: '0.85rem',
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span>{statusMessage}</span>
          {convertedPath && (
            <button
              onClick={handleOpenFolder}
              style={{
                backgroundColor: '#00f3ff',
                color: '#0a0a12',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              Show in Folder ↗
            </button>
          )}
        </div>
      )}
    </div>
  )
}
