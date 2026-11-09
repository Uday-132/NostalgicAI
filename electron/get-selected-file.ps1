Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinDetector {
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }
    
    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);
    
    [DllImport("user32.dll")]
    public static extern IntPtr WindowFromPoint(POINT Point);
    
    [DllImport("user32.dll")]
    public static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);
    
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);
}
"@

$pt = New-Object WinDetector+POINT
[WinDetector]::GetCursorPos([ref]$pt) | Out-Null

$hwnd = [WinDetector]::WindowFromPoint($pt)
$rootHwnd = [WinDetector]::GetAncestor($hwnd, 2)
if ($rootHwnd -eq [IntPtr]::Zero) {
    $rootHwnd = [WinDetector]::GetForegroundWindow()
}

$sb = New-Object System.Text.StringBuilder 256
[WinDetector]::GetClassName($rootHwnd, $sb, 256) | Out-Null
$cls = $sb.ToString()

$shell = New-Object -ComObject Shell.Application

# 1. If cursor/focus is in an open File Explorer window
if ($cls -in @('CabinetWClass', 'ExploreWClass')) {
    foreach ($w in $shell.Windows()) {
        try {
            if ($w.LocationName -ne 'Desktop' -and ($w.HWND -eq $rootHwnd -or $w.HWND -eq [WinDetector]::GetForegroundWindow())) {
                $items = $w.Document.SelectedItems()
                if ($items -and $items.Count -gt 0) {
                    $p = $items.Item(0).Path
                    if ($p -and (Test-Path $p)) { Write-Output $p; exit 0 }
                }
            }
        } catch {}
    }
}

# 2. Check foreground Explorer window
$fgHwnd = [WinDetector]::GetForegroundWindow()
foreach ($w in $shell.Windows()) {
    try {
        if ($w.LocationName -ne 'Desktop' -and $w.HWND -eq $fgHwnd) {
            $items = $w.Document.SelectedItems()
            if ($items -and $items.Count -gt 0) {
                $p = $items.Item(0).Path
                if ($p -and (Test-Path $p)) { Write-Output $p; exit 0 }
            }
        }
    } catch {}
}

# Never return sticky desktop FocusedItem!
exit 0
