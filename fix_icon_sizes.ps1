# PowerShell script to copy existing launcher icons as foreground icons
# This is a temporary fix - you should edit the foreground icons to make the graphic larger

$resPath = "android\app\src\main\res"
$densities = @("mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi")

foreach ($density in $densities) {
    $sourcePath = Join-Path $resPath "mipmap-$density\ic_launcher.png"
    $destPath = Join-Path $resPath "mipmap-$density\ic_launcher_foreground.png"
    
    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath $destPath -Force
        Write-Host "Copied icon for $density"
    } else {
        Write-Host "Warning: Source icon not found for $density"
    }
}

Write-Host "`nDone! Foreground icons created."
Write-Host "IMPORTANT: You still need to edit these icons to make the graphic larger (80-90% of icon area)."
Write-Host "See ICON_FIX_INSTRUCTIONS.md for details."

