# Makes sure Node.js is available, installing it if needed.
#
# Only the full path to node.exe is written to stdout, so the launcher can
# capture it; everything else goes to stderr. Exit code 0 means usable.
#
# Two routes, in order:
#   1. winget install OpenJS.NodeJS.LTS   -- the normal system install
#   2. the official Windows zip, unpacked into the user's own folder
# The second needs no administrator rights, so it still works when winget is
# missing, blocked, or its installer is waiting for a permission prompt.

param([switch]$LocalOnly)

$ErrorActionPreference = "Stop"

function Say([string]$message) {
    [Console]::Error.WriteLine($message)
}

function Find-Node {
    $candidates = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) { return $candidate }
    }

    # A copy unpacked here by an earlier run. Node is not on PATH in that case,
    # so it has to be looked for on disk.
    $portable = Join-Path $env:LOCALAPPDATA "HuaweiDashboard\node"
    if (Test-Path $portable) {
        $exe = Get-ChildItem $portable -Recurse -Filter node.exe -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($exe) { return $exe.FullName }
    }

    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    return $null
}

function Install-WithWinget {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) { return $null }

    Say "Installing Node.js with winget..."
    $arguments = @(
        "install", "--id", "OpenJS.NodeJS.LTS", "--exact",
        "--silent", "--accept-package-agreements", "--accept-source-agreements",
        "--disable-interactivity"
    )
    try {
        $process = Start-Process -FilePath $winget.Source -ArgumentList $arguments `
            -NoNewWindow -PassThru
    } catch {
        return $null
    }

    # A permission prompt the user never answers would hang this forever, so
    # give it a few minutes and then move to the zip, which needs no elevation.
    $process | Wait-Process -Timeout 300 -ErrorAction SilentlyContinue
    if (-not $process.HasExited) {
        Say "winget did not finish; using the direct download instead."
        try { $process | Stop-Process -Force } catch { }
        return $null
    }

    # The exit code is not the signal here: when Node is already installed and
    # up to date, winget reports an error ("no upgrade available"). Whether it
    # worked is answered by looking for the program again.
    return Find-Node
}

function Install-FromZip {
    Say "Downloading Node.js..."

    $index = Invoke-RestMethod "https://nodejs.org/dist/index.json" -TimeoutSec 60
    $lts = $index | Where-Object { $_.lts } | Select-Object -First 1
    if (-not $lts) { throw "No long-term-support release was listed." }

    $folder = Join-Path $env:LOCALAPPDATA "HuaweiDashboard\node"
    $archive = Join-Path $env:TEMP "node-lts.zip"

    $url = "https://nodejs.org/dist/$($lts.version)/node-$($lts.version)-win-x64.zip"
    Invoke-WebRequest $url -OutFile $archive -TimeoutSec 900

    if (Test-Path $folder) { Remove-Item $folder -Recurse -Force }
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    Expand-Archive -Path $archive -DestinationPath $folder -Force
    Remove-Item $archive -Force -ErrorAction SilentlyContinue

    $exe = Get-ChildItem $folder -Recurse -Filter node.exe | Select-Object -First 1
    if (-not $exe) { throw "The downloaded archive did not contain node.exe." }
    return $exe.FullName
}

try {
    $node = if ($LocalOnly) { $null } else { Find-Node }

    if (-not $node -and -not $LocalOnly) {
        $node = Install-WithWinget
    }
    if (-not $node) {
        $node = Install-FromZip
    }
    if (-not $node) {
        throw "Node.js could not be found or installed."
    }

    Write-Output $node
    exit 0
} catch {
    Say ""
    Say "Could not set up Node.js: $($_.Exception.Message)"
    Say "Check that this computer is connected to the internet."
    exit 1
}
