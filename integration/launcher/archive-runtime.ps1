param([Parameter(Mandatory=$true)][ValidateSet('Create','Verify')][string]$Action,
      [Parameter(Mandatory=$true)][string]$Source,
      [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath $Source).Path
$archivePath = [IO.Path]::GetFullPath($Destination)
Add-Type -AssemblyName System.IO.Compression.FileSystem
if ($Action -eq 'Create') {
    if (Test-Path -LiteralPath $archivePath) { throw 'Archive already exists.' }
    [IO.Compression.ZipFile]::CreateFromDirectory($sourceRoot, $archivePath, [IO.Compression.CompressionLevel]::Optimal, $false)
    exit 0
}
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    $entries = @{}
    foreach ($entry in $archive.Entries) {
        if ($entry.FullName.EndsWith('/')) { continue }
        if ($entries.ContainsKey($entry.FullName)) { throw "Duplicate ZIP entry: $($entry.FullName)" }
        $entries[$entry.FullName] = $entry
    }
    $count = 0
    foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -Recurse -File) {
        $relative = [IO.Path]::GetRelativePath($sourceRoot, $file.FullName).Replace('\','/')
        if (-not $entries.ContainsKey($relative)) { throw "Missing ZIP entry: $relative" }
        $entry = $entries[$relative]
        if ($entry.Length -ne $file.Length) { throw "ZIP size mismatch: $relative" }
        $stream = $entry.Open()
        try { $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)).ToLowerInvariant() }
        finally { $stream.Dispose() }
        if ($hash -ne (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "ZIP hash mismatch: $relative" }
        $count++
    }
    if ($count -ne $entries.Count) { throw 'Unexpected extra files in ZIP.' }
    Write-Output "Verified $count ZIP entries byte-for-byte."
} finally { $archive.Dispose() }
