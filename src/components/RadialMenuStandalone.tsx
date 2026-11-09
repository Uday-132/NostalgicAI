import { useState, useEffect } from 'react'
import { ConvertOption, getAvailableConvertOptions } from './RadialMenu'

export function RadialMenuStandalone() {
  const [filePath, setFilePath] = useState<string>('')
  const [isConverting, setIsConverting] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [convertedPath, setConvertedPath] = useState<string | null>(null)

  useEffect(() => {
    if (window.ipcRenderer) {
      const removeListener = window.ipcRenderer.on('init-radial-file', (_event: any, path: string) => {
        // ALWAYS update with the new file or clear if none
        setFilePath(path ? path.trim() : '')
        setSelectedFormat(null)
        setStatusMessage(null)
        setConvertedPath(null)
        setIsConverting(false)
      })
      return () => removeListener()
    }
  }, [])

  // Listen for Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleClose = () => {
    if (window.ipcRenderer) {
      window.ipcRenderer.send('hide-radial-window')
    }
    setFilePath('')
    setSelectedFormat(null)
    setStatusMessage(null)
    setConvertedPath(null)
    setIsConverting(false)
  }

  const handleSelectFile = async () => {
    if (window.ipcRenderer) {
      const selected = await window.ipcRenderer.invoke('select-file')
      if (selected) {
        setFilePath(selected)
        setSelectedFormat(null)
        setStatusMessage(null)
        setConvertedPath(null)
      }
    }
  }

  const name = filePath ? filePath.split(/[/\\]/).pop() || 'Selected Document' : 'Document'
  const ext = (name.split('.').pop() || '').toLowerCase()
  const options: ConvertOption[] = filePath ? getAvailableConvertOptions(filePath) : []

  const handleSelectOption = async (option: ConvertOption) => {
    if (isConverting || !filePath) return
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
          setStatusMessage(`Converted to ${option.label}! Saved in place.`)
          setConvertedPath(result.outputPath)
        } else {
          setStatusMessage(`Error: ${result.error || 'Conversion failed'}`)
        }
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
      setTimeout(handleClose, 800)
    }
  }

  const count = options.length || 1
  const radius = count > 5 ? 150 : 135
  const btnSize = count > 5 ? 64 : 74
  const iconSize = count > 5 ? '1.25rem' : '1.5rem'
  const labelSize = count > 5 ? '0.56rem' : '0.64rem'

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        position: 'relative',
        userSelect: 'none'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '420px',
          height: '420px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Glowing Radial Outer Track */}
        <div
          style={{
            position: 'absolute',
            width: count > 5 ? '340px' : '310px',
            height: count > 5 ? '340px' : '310px',
            borderRadius: '50%',
            border: '2px dashed rgba(0, 243, 255, 0.45)',
            boxShadow: '0 0 45px rgba(0, 243, 255, 0.25)',
            pointerEvents: 'none',
            animation: isConverting ? 'spin 3s linear infinite' : 'none'
          }}
        />

        {/* Center Node: The target file */}
        <div
          onClick={!filePath ? handleSelectFile : undefined}
          style={{
            width: count > 5 ? '132px' : '144px',
            height: count > 5 ? '132px' : '144px',
            borderRadius: '50%',
            backgroundColor: '#15161e',
            border: '2px solid #00f3ff',
            boxShadow: '0 0 30px rgba(0, 243, 255, 0.5), inset 0 0 25px rgba(0, 0, 0, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            padding: '10px',
            textAlign: 'center',
            color: '#fff',
            cursor: !filePath ? 'pointer' : 'default'
          }}
        >
          <span style={{ fontSize: count > 5 ? '1.8rem' : '2.1rem', marginBottom: '2px' }}>
            {!filePath ? '📁' : ['ppt', 'pptx'].includes(ext) ? '📊' : ['doc', 'docx'].includes(ext) ? '📝' : ext === 'pdf' ? '📄' : ['xls', 'xlsx'].includes(ext) ? '📈' : ['jpg', 'png', 'jpeg'].includes(ext) ? '🖼️' : '📁'}
          </span>
          <div
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              maxWidth: '105px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: '#00f3ff'
            }}
            title={filePath ? name : 'Choose File'}
          >
            {filePath ? name : 'Choose File'}
          </div>
          <span
            style={{
              fontSize: '0.58rem',
              color: '#8e92a4',
              marginTop: '2px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 600
            }}
          >
            {filePath && ext ? `${ext.toUpperCase()} FILE` : 'CLICK TO SELECT'}
          </span>

          {isConverting ? (
            <div style={{ fontSize: '0.62rem', color: '#ff00ff', marginTop: '4px', fontWeight: 'bold' }}>
              PROCESSING...
            </div>
          ) : (
            <div style={{ fontSize: '0.56rem', color: '#686b78', marginTop: '2px' }}>
              {filePath ? 'Select tool' : 'Pick document'}
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
                width: `${btnSize}px`,
                height: `${btnSize}px`,
                borderRadius: '50%',
                backgroundColor: isSelected ? '#00f3ff' : '#1a1b24',
                color: isSelected ? '#0b0c10' : '#ffffff',
                border: isSelected ? '2px solid #ffffff' : '2px solid rgba(0, 243, 255, 0.4)',
                boxShadow: isSelected
                  ? '0 0 25px #00f3ff'
                  : '0 8px 25px rgba(0, 0, 0, 0.8)',
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
                  e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 243, 255, 0.7)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isConverting) {
                  e.currentTarget.style.transform = `translate(${x}px, ${y}px) scale(1)`
                  e.currentTarget.style.borderColor = isSelected ? '#ffffff' : 'rgba(0, 243, 255, 0.4)'
                  e.currentTarget.style.boxShadow = isSelected ? '0 0 25px #00f3ff' : '0 8px 25px rgba(0, 0, 0, 0.8)'
                }
              }}
            >
              <span style={{ fontSize: iconSize, lineHeight: 1 }}>{opt.icon}</span>
              <span style={{ fontSize: labelSize, fontWeight: 700, marginTop: '2px', textAlign: 'center', maxWidth: '58px', lineHeight: 1.1 }}>
                {opt.format.toUpperCase()}
              </span>
            </button>
          )
        })}

        {/* Close Button top-right of wheel */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: '#2b2c36',
            color: '#a0a3b2',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            zIndex: 30
          }}
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Floating Status Notification */}
      {statusMessage && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            backgroundColor: '#161720',
            border: '1px solid #00f3ff',
            borderRadius: '10px',
            padding: '8px 16px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.9), 0 0 15px rgba(0, 243, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#fff',
            fontSize: '0.8rem',
            zIndex: 100
          }}
        >
          <span>{statusMessage}</span>
          {convertedPath && (
            <button
              onClick={handleOpenFolder}
              style={{
                backgroundColor: '#00f3ff',
                color: '#0a0a12',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.72rem',
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

