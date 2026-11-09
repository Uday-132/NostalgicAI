Add-Type -AssemblyName System.Windows.Forms
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

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const byte VK_CONTROL = 0x11;
    public const byte VK_C = 0x43;

    public static void SendCtrlC() {
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
        keybd_event(VK_C, 0, 0, UIntPtr.Zero);
        keybd_event(VK_C, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@

function Get-FileUnderCursor {
    # 1. Clear clipboard first so no stale file from earlier can ever be read
    try {
        [System.Windows.Forms.Clipboard]::Clear()
    } catch {}

    # 2. Trigger native Ctrl+C on the clicked/focused item
    try {
        [WinDetector]::SendCtrlC()
        Start-Sleep -Milliseconds 120

        if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
            $files = [System.Windows.Forms.Clipboard]::GetFileDropList()
            if ($files -and $files.Count -gt 0) {
                $p = $files[0]
                if (Test-Path $p) { return $p }
            }
        }
        
        $t = [System.Windows.Forms.Clipboard]::GetText()
        if ($t) {
            $clean = $t.Trim('"', "'", " ", "`r", "`n")
            if (Test-Path $clean) { return $clean }
        }
    } catch {}

    # 3. If clipboard wasn't populated, check active File Explorer window (non-Desktop)
    try {
        $pt = New-Object WinDetector+POINT
        [WinDetector]::GetCursorPos([ref]$pt) | Out-Null
        $hwnd = [WinDetector]::WindowFromPoint($pt)
        $rootHwnd = [WinDetector]::GetAncestor($hwnd, 2)
        if ($rootHwnd -eq [IntPtr]::Zero) {
            $rootHwnd = [WinDetector]::GetForegroundWindow()
        }

        $shell = New-Object -ComObject Shell.Application
        foreach ($w in $shell.Windows()) {
            try {
                if ($w.LocationName -ne 'Desktop' -and ($w.HWND -eq $rootHwnd -or $w.HWND -eq [WinDetector]::GetForegroundWindow())) {
                    $items = $w.Document.SelectedItems()
                    if ($items -and $items.Count -gt 0) {
                        $p = $items.Item(0).Path
                        if ($p -and (Test-Path $p)) { return $p }
                    }
                }
            } catch {}
        }
    } catch {}

    # Never return sticky desktop FocusedItem!
    return ""
}

$lastTrigger = 0
while ($true) {
    Start-Sleep -Milliseconds 35
    # 0x11 = VK_CONTROL, 0x01 = VK_LBUTTON
    $ctrlPressed = [WinDetector]::GetAsyncKeyState(0x11) -band 0x8000
    $lbuttonPressed = [WinDetector]::GetAsyncKeyState(0x01) -band 0x8000

    if ($ctrlPressed -and $lbuttonPressed) {
        $now = [Environment]::TickCount
        if ($now - $lastTrigger -gt 1000) {
            $lastTrigger = $now
            
            # Wait for user to RELEASE the mouse button so Explorer finishes selection
            while ([WinDetector]::GetAsyncKeyState(0x01) -band 0x8000) {
                Start-Sleep -Milliseconds 20
            }
            Start-Sleep -Milliseconds 60
            
            # Fetch the exact file currently under cursor / clicked
            $foundPath = Get-FileUnderCursor
            
            [System.Console]::WriteLine("CTRL_CLICK:" + $foundPath)
            [System.Console]::Out.Flush()
        }
    }
}
