Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinTest {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
    
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
}
"@

$fg = [WinTest]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[WinTest]::GetWindowText($fg, $sb, 256) | Out-Null
Write-Output ("Foreground window title: " + $sb.ToString())

$shell = New-Object -ComObject Shell.Application
Write-Output "--- SHELL WINDOWS ---"
foreach ($w in $shell.Windows()) {
    try {
        Write-Output ("Name: " + $w.LocationName + " | HWND: " + $w.HWND)
        $sel = $w.Document.SelectedItems()
        Write-Output ("  Selected count: " + $sel.Count)
        for ($i = 0; $i -lt $sel.Count; $i++) {
            Write-Output ("    [" + $i + "]: " + $sel.Item($i).Path)
        }
    } catch {
        Write-Output ("  Error: " + $_.Exception.Message)
    }
}

Write-Output "--- CLIPBOARD ---"
if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
    $c = [System.Windows.Forms.Clipboard]::GetFileDropList()
    foreach ($f in $c) {
        Write-Output ("  FileDrop: " + $f)
    }
} else {
    Write-Output "  No FileDrop in clipboard"
}

