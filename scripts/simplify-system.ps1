# PowerShell Script to Simplify System to 2 Roles
# Run this in PowerShell from project root

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  System Simplification Script" -ForegroundColor Cyan
Write-Host "  Converting to 2 Roles Only" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Confirm before proceeding
$confirm = Read-Host "This will DELETE multiple directories. Have you created a backup? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Aborting. Please create a backup first!" -ForegroundColor Red
    Write-Host "Run: git add . && git commit -m 'Backup before simplification'" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "Starting deletion process..." -ForegroundColor Green
Write-Host ""

# Define directories to remove
$dirsToRemove = @(
    "app\packer",
    "app\tracker",
    "app\dept-manager",
    "app\logistics",
    "app\admin",
    "app\dashboard\dispatch",
    "app\dashboard\packing-queue",
    "app\dashboard\track-orders",
    "app\dashboard\agent-performance",
    "app\dashboard\operations",
    "app\dashboard\sales-channels",
    "app\dashboard\insights",
    "app\dashboard\reports",
    "app\api\packer",
    "app\api\departments",
    "app\api\dept-manager",
    "app\api\check-create-packer",
    "app\api\debug-packer",
    "app\api\reports",
    "app\api\auth\team-leader-login",
    "app\api\auth\team-leader-logout",
    "app\api\auth\team-leader-change-password"
)

# Define files to remove
$filesToRemove = @(
    "components\barcode-scanner.tsx"
)

# Remove directories
foreach ($dir in $dirsToRemove) {
    if (Test-Path $dir) {
        Write-Host "[DELETE DIR] $dir" -ForegroundColor Yellow
        Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ Deleted" -ForegroundColor Green
    } else {
        Write-Host "[SKIP] $dir (not found)" -ForegroundColor Gray
    }
}

Write-Host ""

# Remove files
foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Write-Host "[DELETE FILE] $file" -ForegroundColor Yellow
        Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ Deleted" -ForegroundColor Green
    } else {
        Write-Host "[SKIP] $file (not found)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deletion Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Apply database migration in Supabase SQL Editor" -ForegroundColor White
Write-Host "   File: supabase\migrations\062_simplify_to_two_roles.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Update navigation/sidebar component" -ForegroundColor White
Write-Host "   Remove links to deleted pages" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test the system:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Review: SIMPLIFICATION_COMPLETE.md" -ForegroundColor White
Write-Host ""

