import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import AdmZip from 'adm-zip'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { jsPDF } from 'jspdf'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function runAdvancedPdf(action: string, filePath: string, outputPath: string): Promise<{ success: boolean; outputPath: string; error?: string }> {
  return new Promise((resolve) => {
    const venvPython = path.join(process.env.APP_ROOT || path.join(__dirname, '..'), '.venv', 'Scripts', 'python.exe')
    let pythonCmd = 'python'
    try {
      const fsSync = require('node:fs')
      if (fsSync.existsSync(venvPython)) {
        pythonCmd = venvPython
      }
    } catch {}

    const pythonScript = path.join(process.env.APP_ROOT || path.join(__dirname, '..'), 'electron', 'advanced_pdf.py')
    console.log(`[Converter] Running advanced_pdf (${action}): ${filePath} -> ${outputPath}`)

    const child = spawn(pythonCmd, [pythonScript, action, filePath, outputPath])
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('close', (code) => {
      console.log(`[Converter] advanced_pdf finished (code ${code}):`, stdout.trim())
      const match = stdout.match(/SUCCESS:(.+)/)
      if (code === 0 && match) {
        resolve({ success: true, outputPath: match[1].trim() })
      } else {
        const errMsg = stderr.trim() || stdout.trim() || `Process exited with code ${code}`
        resolve({ success: false, outputPath: '', error: errMsg })
      }
    })
    child.on('error', (err) => {
      resolve({ success: false, outputPath: '', error: err.message })
    })
    setTimeout(() => {
      try { child.kill() } catch (e) {}
      resolve({ success: false, outputPath: '', error: 'Operation timed out after 120 seconds' })
    }, 120000)
  })
}

function runPythonPdfToDocx(filePath: string, outputPath: string): Promise<{ success: boolean; outputPath: string; error?: string }> {
  return new Promise((resolve) => {
    // 1. Locate python binary: prefer .venv python, fallback to system python
    const venvPython = path.join(process.env.APP_ROOT || path.join(__dirname, '..'), '.venv', 'Scripts', 'python.exe')
    let pythonCmd = 'python'
    try {
      const fsSync = require('node:fs')
      if (fsSync.existsSync(venvPython)) {
        pythonCmd = venvPython
      }
    } catch {}

    const pythonScript = path.join(process.env.APP_ROOT || path.join(__dirname, '..'), 'electron', 'pdf_to_docx.py')
    console.log(`[Converter] Running pdf2docx with '${pythonCmd}': ${filePath} -> ${outputPath}`)

    const child = spawn(pythonCmd, [pythonScript, filePath, outputPath])
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('close', (code) => {
      console.log(`[Converter] pdf2docx finished (code ${code}):`, stdout.trim())
      const match = stdout.match(/SUCCESS:(.+)/)
      if (code === 0 && match) {
        const actualPath = match[1].trim()
        resolve({ success: true, outputPath: actualPath })
      } else {
        const errMsg = stderr.trim() || stdout.trim() || `Process exited with code ${code}`
        console.warn('[Converter] pdf2docx failed:', errMsg)
        resolve({ success: false, outputPath: '', error: errMsg })
      }
    })
    child.on('error', (err) => {
      console.warn('[Converter] pdf2docx spawn error:', err)
      resolve({ success: false, outputPath: '', error: err.message })
    })
    // Generous 180s timeout for large multi-page documents
    setTimeout(() => {
      try { child.kill() } catch (e) {}
      resolve({ success: false, outputPath: '', error: 'Conversion timed out after 180 seconds' })
    }, 180000)
  })
}

function runOfficeConvert(filePath: string, targetFormat: string, outputPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const psScript = path.join(process.env.APP_ROOT || path.join(__dirname, '..'), 'electron', 'office-convert.ps1')
    console.log(`[Converter] Attempting high-fidelity Office engine: ${filePath} -> ${targetFormat}`)

    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', psScript,
      '-InputPath', filePath,
      '-TargetFormat', targetFormat,
      '-OutputPath', outputPath
    ])

    let output = ''
    child.stdout.on('data', (d) => { output += d.toString() })
    child.on('close', (code) => {
      console.log(`[Converter] Office engine result (code ${code}):`, output.trim())
      if (code === 0 && output.includes('SUCCESS:')) {
        resolve(true)
      } else {
        resolve(false)
      }
    })
    child.on('error', (err) => {
      console.warn('[Converter] Office script error:', err)
      resolve(false)
    })
    setTimeout(() => {
      try { child.kill() } catch (e) {}
      resolve(false)
    }, 120000)
  })
}

export interface ConvertOption {
  format: string
  label: string
  icon: string
  extension: string
  description: string
}

// Map each extension to available target formats (excluding its own format)
export function getAvailableConvertOptions(filePath: string): ConvertOption[] {
  const ext = path.extname(filePath).toLowerCase().replace('.', '')
  
  const allOptions: Record<string, ConvertOption> = {
    pdf: { format: 'pdf', label: 'PDF Document', icon: '📄', extension: '.pdf', description: 'Portable Document Format' },
    word: { format: 'word', label: 'Word (.docx)', icon: '📝', extension: '.docx', description: 'Microsoft Word Document' },
    txt: { format: 'txt', label: 'Text (.txt)', icon: '📋', extension: '.txt', description: 'Plain text document' },
    html: { format: 'html', label: 'Web (.html)', icon: '🌐', extension: '.html', description: 'HTML document' },
    md: { format: 'md', label: 'Markdown (.md)', icon: '📑', extension: '.md', description: 'Markdown formatted file' },
  }

  // If input is PowerPoint (ppt, pptx)
  if (['ppt', 'pptx'].includes(ext)) {
    return [allOptions.pdf, allOptions.word, allOptions.txt, allOptions.html]
  }

  // If input is PDF
  if (ext === 'pdf') {
    return [allOptions.word, allOptions.txt, allOptions.html, allOptions.md]
  }

  // If input is Word (doc, docx)
  if (['doc', 'docx'].includes(ext)) {
    return [allOptions.pdf, allOptions.txt, allOptions.html, allOptions.md]
  }

  // If input is Text or Markdown
  if (['txt', 'md', 'markdown'].includes(ext)) {
    return [allOptions.pdf, allOptions.word, allOptions.html]
  }

  // Default fallback for any other text/document
  return [allOptions.pdf, allOptions.word, allOptions.txt]
}

// Extract content from different document types
export async function extractContent(filePath: string): Promise<{ title: string; sections: string[]; rawText: string }> {
  const ext = path.extname(filePath).toLowerCase()
  const baseName = path.basename(filePath, ext)

  if (ext === '.pptx') {
    try {
      const zip = new AdmZip(filePath)
      const zipEntries = zip.getEntries()
      const slideEntries = zipEntries
        .filter(entry => entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml'))
        .sort((a, b) => {
          const numA = parseInt(a.entryName.replace(/\D/g, '') || '0', 10)
          const numB = parseInt(b.entryName.replace(/\D/g, '') || '0', 10)
          return numA - numB
        })

      const sections: string[] = []
      for (const entry of slideEntries) {
        const xml = entry.getData().toString('utf8')
        // Match all text inside <a:t>...</a:t>
        const matches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/g)
        if (matches) {
          const slideText = matches
            .map(m => m.replace(/<[^>]+>/g, '').trim())
            .filter(Boolean)
            .join(' ')
          if (slideText) sections.push(slideText)
        }
      }

      const rawText = sections.map((sec, i) => `Slide ${i + 1}:\n${sec}`).join('\n\n')
      return { title: baseName, sections, rawText: rawText || 'Empty Presentation' }
    } catch (err: any) {
      console.warn('PPTX parsing fallback:', err)
      const buffer = await fs.readFile(filePath)
      return { title: baseName, sections: [baseName], rawText: buffer.toString('utf-8', 0, 2000) }
    }
  }

  if (ext === '.docx') {
    try {
      const mammoth = await import('mammoth')
      const buffer = await fs.readFile(filePath)
      const result = await mammoth.extractRawText({ buffer })
      const text = result.value
      const sections = text.split('\n\n').filter(s => s.trim().length > 0)
      return { title: baseName, sections, rawText: text }
    } catch (err) {
      const text = await fs.readFile(filePath, 'utf-8')
      return { title: baseName, sections: [text], rawText: text }
    }
  }

  if (ext === '.pdf') {
    try {
      const buffer = await fs.readFile(filePath)
      const pdfModule = require('pdf-parse')
      const PDFParse = pdfModule.PDFParse || pdfModule.default || pdfModule
      const uint8 = new Uint8Array(buffer)
      const parser = new PDFParse(uint8)
      const data = await parser.getText()
      const text = data.text || ''
      const sections = text.split('\n\n').filter((s: string) => s.trim().length > 0)
      return { title: baseName, sections, rawText: text }
    } catch (err) {
      const text = await fs.readFile(filePath, 'utf-8').catch(() => 'Unable to read raw PDF')
      return { title: baseName, sections: [text], rawText: text }
    }
  }

  // Plain text / markdown
  const text = await fs.readFile(filePath, 'utf-8')
  const sections = text.split('\n\n').filter(s => s.trim().length > 0)
  return { title: baseName, sections, rawText: text }
}

// Convert file and write output in the exact same directory ("paste in that place only")
export async function convertFile(filePath: string, targetFormat: string): Promise<{ success: boolean; outputPath: string; error?: string }> {
  try {
    const dir = path.dirname(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const baseName = path.basename(filePath, ext)

    let targetExt = `.${targetFormat}`
    if (targetFormat === 'word') targetExt = '.docx'
    let outputPath = path.join(dir, `${baseName}${targetExt}`)
    if (outputPath.toLowerCase() === filePath.toLowerCase()) {
      outputPath = path.join(dir, `${baseName}_converted${targetExt}`)
    }

    // 1. If converting PDF to Word: use Python pdf2docx for exact layout & table fidelity (identical to ilovepdf!)
    if (ext === '.pdf' && (targetFormat === 'word' || targetFormat === 'docx')) {
      const pythonRes = await runPythonPdfToDocx(filePath, outputPath)
      if (pythonRes.success) {
        return { success: true, outputPath: pythonRes.outputPath }
      } else {
        return { success: false, outputPath: '', error: pythonRes.error || 'Python pdf2docx conversion failed' }
      }
    }

    // 2. PDF to PowerPoint (PDF to PPTX)
    if (ext === '.pdf' && (targetFormat === 'ppt' || targetFormat === 'pptx')) {
      outputPath = path.join(dir, `${baseName}.pptx`)
      return await runAdvancedPdf('pdf-to-ppt', filePath, outputPath)
    }

    // 3. PDF to Excel (PDF to XLSX)
    if (ext === '.pdf' && (targetFormat === 'excel' || targetFormat === 'xlsx')) {
      outputPath = path.join(dir, `${baseName}.xlsx`)
      return await runAdvancedPdf('pdf-to-excel', filePath, outputPath)
    }

    // 4. PDF to JPG images
    if (ext === '.pdf' && (targetFormat === 'jpg' || targetFormat === 'jpeg')) {
      return await runAdvancedPdf('pdf-to-jpg', filePath, dir)
    }

    // 5. Split PDF into individual pages
    if (ext === '.pdf' && targetFormat === 'split') {
      return await runAdvancedPdf('split', filePath, dir)
    }

    // 6. Compress PDF
    if (ext === '.pdf' && targetFormat === 'compress') {
      outputPath = path.join(dir, `${baseName}_compressed.pdf`)
      return await runAdvancedPdf('compress', filePath, outputPath)
    }

    // 7. PDF to PDF/A
    if (ext === '.pdf' && targetFormat === 'pdfa') {
      outputPath = path.join(dir, `${baseName}_pdfa.pdf`)
      return await runAdvancedPdf('pdf-to-pdfa', filePath, outputPath)
    }

    // 8. Convert Images (JPG, PNG) to PDF
    if (['.jpg', '.jpeg', '.png', '.bmp', '.webp'].includes(ext) && targetFormat === 'pdf') {
      outputPath = path.join(dir, `${baseName}.pdf`)
      return await runAdvancedPdf('jpg-to-pdf', filePath, outputPath)
    }

    // 9. Convert HTML to PDF
    if (['.html', '.htm'].includes(ext) && targetFormat === 'pdf') {
      outputPath = path.join(dir, `${baseName}.pdf`)
      return await runAdvancedPdf('html-to-pdf', filePath, outputPath)
    }

    // 10. High-fidelity native Office conversion (PPT -> PDF vector, Word -> PDF vector, Excel -> PDF)
    if (['.ppt', '.pptx', '.doc', '.docx', '.xls', '.xlsx'].includes(ext) && targetFormat === 'pdf') {
      const officeOk = await runOfficeConvert(filePath, targetFormat, outputPath)
      if (officeOk) {
        return { success: true, outputPath }
      } else {
        return { success: false, outputPath: '', error: 'High-fidelity Office PDF export failed. Please check if Office is active and retry.' }
      }
    }

    // 2. Fallback to node-based conversion if Office is unavailable
    const { title, sections, rawText } = await extractContent(filePath)

    if (targetFormat === 'pdf') {
      outputPath = path.join(dir, `${baseName}.pdf`)
      // Check if same name exists
      if (outputPath.toLowerCase() === filePath.toLowerCase()) {
        outputPath = path.join(dir, `${baseName}_converted.pdf`)
      }

      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.text(title, 14, 20)
      doc.setFontSize(11)

      let y = 30
      const pageHeight = doc.internal.pageSize.height
      const margin = 14
      const maxLineWidth = 180

      const lines = doc.splitTextToSize(rawText, maxLineWidth)
      for (const line of lines) {
        if (y + 10 > pageHeight - 15) {
          doc.addPage()
          y = 20
        }
        doc.text(line, margin, y)
        y += 7
      }

      const pdfBytes = doc.output('arraybuffer')
      await fs.writeFile(outputPath, Buffer.from(pdfBytes))
      return { success: true, outputPath }
    }

    if (targetFormat === 'word') {
      outputPath = path.join(dir, `${baseName}.docx`)
      if (outputPath.toLowerCase() === filePath.toLowerCase()) {
        outputPath = path.join(dir, `${baseName}_converted.docx`)
      }

      const paragraphs = [
        new Paragraph({
          text: title,
          heading: HeadingLevel.TITLE,
          spacing: { after: 200 },
        }),
        ...sections.map(sec => new Paragraph({
          children: [new TextRun(sec)],
          spacing: { after: 140 },
        }))
      ]

      const doc = new Document({
        sections: [{ properties: {}, children: paragraphs }],
      })

      const buffer = await Packer.toBuffer(doc)
      await fs.writeFile(outputPath, buffer)
      return { success: true, outputPath }
    }

    if (targetFormat === 'txt') {
      outputPath = path.join(dir, `${baseName}.txt`)
      if (outputPath.toLowerCase() === filePath.toLowerCase()) {
        outputPath = path.join(dir, `${baseName}_converted.txt`)
      }
      await fs.writeFile(outputPath, rawText, 'utf-8')
      return { success: true, outputPath }
    }

    if (targetFormat === 'html') {
      outputPath = path.join(dir, `${baseName}.html`)
      if (outputPath.toLowerCase() === filePath.toLowerCase()) {
        outputPath = path.join(dir, `${baseName}_converted.html`)
      }
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
    h1 { color: #111; border-bottom: 2px solid #eaeaea; padding-bottom: 10px; }
    p { margin-bottom: 1.2em; }
    .meta { font-size: 0.85em; color: #777; margin-bottom: 30px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Converted by NostalgicAI from ${ext.replace('.', '').toUpperCase()}</div>
  ${sections.map(s => `<p>${s.replace(/\n/g, '<br>')}</p>`).join('\n')}
</body>
</html>`
      await fs.writeFile(outputPath, htmlContent, 'utf-8')
      return { success: true, outputPath }
    }

    if (targetFormat === 'md') {
      outputPath = path.join(dir, `${baseName}.md`)
      if (outputPath.toLowerCase() === filePath.toLowerCase()) {
        outputPath = path.join(dir, `${baseName}_converted.md`)
      }
      const mdContent = `# ${title}\n\n*Converted by NostalgicAI from ${ext.replace('.', '').toUpperCase()}*\n\n` +
        sections.join('\n\n')
      await fs.writeFile(outputPath, mdContent, 'utf-8')
      return { success: true, outputPath }
    }

    throw new Error(`Unsupported target format: ${targetFormat}`)
  } catch (error: any) {
    console.error('File conversion error:', error)
    return { success: false, outputPath: '', error: error.message }
  }
}

