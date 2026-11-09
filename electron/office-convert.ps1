param (
    [string]$InputPath,
    [string]$TargetFormat,
    [string]$OutputPath
)

$ext = [System.IO.Path]::GetExtension($InputPath).ToLower().TrimStart('.')
$TargetFormat = $TargetFormat.ToLower().Trim()

$ppt = $null
$pres = $null
$word = $null
$doc = $null

try {
    # 1. PPT/PPTX conversions
    if ($ext -in @('ppt', 'pptx')) {
        if ($TargetFormat -eq 'pdf') {
            # Blazing fast native PowerPoint PDF export (Vector perfect, same as ilovepdf)
            $ppt = New-Object -ComObject PowerPoint.Application
            $pres = $ppt.Presentations.Open($InputPath, 1, 0, 0)
            # 32 = ppSaveAsPDF
            $pres.SaveAs($OutputPath, 32)
            $pres.Close()
            $pres = $null
            $ppt.Quit()
            $ppt = $null
            
            if (Test-Path $OutputPath) {
                Write-Output "SUCCESS:$OutputPath"
                exit 0
            }
        }
        
        # For Word/Txt/HTML from PPTX, let fast Node engine handle it or direct shape export
        if ($TargetFormat -in @('word', 'docx')) {
            $ppt = New-Object -ComObject PowerPoint.Application
            $pres = $ppt.Presentations.Open($InputPath, 1, 0, 0)
            
            $word = New-Object -ComObject Word.Application
            $word.Visible = $false
            $word.DisplayAlerts = 0
            $doc = $word.Documents.Add()
            
            for ($i = 1; $i -le $pres.Slides.Count; $i++) {
                $slide = $pres.Slides.Item($i)
                $slideText = ""
                foreach ($shape in $slide.Shapes) {
                    if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {
                        $slideText += $shape.TextFrame.TextRange.Text + "`r`n"
                    }
                }
                $range = $doc.Content
                $range.Collapse(0)
                $range.InsertAfter("=== Slide $i ===`r`n" + $slideText + "`r`n`r`n")
            }
            $doc.SaveAs([ref]$OutputPath, [ref]16)
            $doc.Close([ref]$false)
            $doc = $null
            $word.Quit()
            $word = $null
            
            $pres.Close()
            $pres = $null
            $ppt.Quit()
            $ppt = $null
            
            if (Test-Path $OutputPath) {
                Write-Output "SUCCESS:$OutputPath"
                exit 0
            }
        }
    }

    # 2. DOC/DOCX conversions
    if ($ext -in @('doc', 'docx')) {
        if ($TargetFormat -eq 'pdf') {
            # Blazing fast native Word PDF export (Vector perfect)
            $word = New-Object -ComObject Word.Application
            $word.Visible = $false
            $word.DisplayAlerts = 0
            $doc = $word.Documents.Open($InputPath, $false, $true)
            # 17 = wdFormatPDF
            $doc.SaveAs([ref]$OutputPath, [ref]17)
            $doc.Close([ref]$false)
            $doc = $null
            $word.Quit()
            $word = $null

            if (Test-Path $OutputPath) {
                Write-Output "SUCCESS:$OutputPath"
                exit 0
            }
        }
    }

    # 3. XLS/XLSX conversions (Excel to PDF)
    if ($ext -in @('xls', 'xlsx')) {
        if ($TargetFormat -eq 'pdf') {
            $xl = New-Object -ComObject Excel.Application
            $xl.Visible = $false
            $xl.DisplayAlerts = $false
            $wb = $xl.Workbooks.Open($InputPath)
            # 0 = xlTypePDF
            $wb.ExportAsFixedFormat(0, $OutputPath)
            $wb.Close($false)
            $wb = $null
            $xl.Quit()
            $xl = $null

            if (Test-Path $OutputPath) {
                Write-Output "SUCCESS:$OutputPath"
                exit 0
            }
        }
    }

    # For other formats, fast Node-based converter takes over instantly
    Write-Output "FALLBACK_NEEDED"
} catch {
    Write-Output ("COM_ERROR:" + $_.Exception.Message)
} finally {
    if ($pres) { try { $pres.Close() } catch {} }
    if ($ppt) { try { $ppt.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null } catch {} }
    if ($doc) { try { $doc.Close([ref]$false) } catch {} }
    if ($word) { try { $word.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null } catch {} }
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
