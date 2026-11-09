Add-Type -AssemblyName System.Windows.Forms

try {
    if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
        $files = [System.Windows.Forms.Clipboard]::GetFileDropList()
        if ($files -and $files.Count -gt 0) {
            Write-Output $files[0]
            exit 0
        }
    }
    
    $text = [System.Windows.Forms.Clipboard]::GetText()
    if ($text) {
        $clean = $text.Trim('"').Trim("'").Trim()
        if (Test-Path $clean) {
            Write-Output $clean
            exit 0
        }
    }
} catch {}

exit 1

