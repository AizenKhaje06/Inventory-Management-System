@echo off
REM Batch Script to Simplify System to 2 Roles
REM Run this from project root

echo ========================================
echo   System Simplification Script
echo   Converting to 2 Roles Only
echo ========================================
echo.

REM Confirm before proceeding
set /p confirm="Have you created a backup? (yes/no): "
if /i not "%confirm%"=="yes" (
    echo.
    echo Aborting! Please create a backup first.
    echo Run: git add . ^&^& git commit -m "Backup before simplification"
    pause
    exit /b
)

echo.
echo Starting deletion process...
echo.

REM Delete role-specific dashboards
if exist "app\packer" (
    echo [DELETE] app\packer
    rmdir /s /q "app\packer"
    echo   OK
)

if exist "app\tracker" (
    echo [DELETE] app\tracker
    rmdir /s /q "app\tracker"
    echo   OK
)

if exist "app\dept-manager" (
    echo [DELETE] app\dept-manager
    rmdir /s /q "app\dept-manager"
    echo   OK
)

if exist "app\logistics" (
    echo [DELETE] app\logistics
    rmdir /s /q "app\logistics"
    echo   OK
)

if exist "app\admin" (
    echo [DELETE] app\admin
    rmdir /s /q "app\admin"
    echo   OK
)

REM Delete complex dashboard features
if exist "app\dashboard\dispatch" (
    echo [DELETE] app\dashboard\dispatch
    rmdir /s /q "app\dashboard\dispatch"
    echo   OK
)

if exist "app\dashboard\packing-queue" (
    echo [DELETE] app\dashboard\packing-queue
    rmdir /s /q "app\dashboard\packing-queue"
    echo   OK
)

if exist "app\dashboard\track-orders" (
    echo [DELETE] app\dashboard\track-orders
    rmdir /s /q "app\dashboard\track-orders"
    echo   OK
)

if exist "app\dashboard\agent-performance" (
    echo [DELETE] app\dashboard\agent-performance
    rmdir /s /q "app\dashboard\agent-performance"
    echo   OK
)

if exist "app\dashboard\operations" (
    echo [DELETE] app\dashboard\operations
    rmdir /s /q "app\dashboard\operations"
    echo   OK
)

if exist "app\dashboard\sales-channels" (
    echo [DELETE] app\dashboard\sales-channels
    rmdir /s /q "app\dashboard\sales-channels"
    echo   OK
)

if exist "app\dashboard\insights" (
    echo [DELETE] app\dashboard\insights
    rmdir /s /q "app\dashboard\insights"
    echo   OK
)

if exist "app\dashboard\reports" (
    echo [DELETE] app\dashboard\reports
    rmdir /s /q "app\dashboard\reports"
    echo   OK
)

REM Delete role-specific APIs
if exist "app\api\packer" (
    echo [DELETE] app\api\packer
    rmdir /s /q "app\api\packer"
    echo   OK
)

if exist "app\api\departments" (
    echo [DELETE] app\api\departments
    rmdir /s /q "app\api\departments"
    echo   OK
)

if exist "app\api\dept-manager" (
    echo [DELETE] app\api\dept-manager
    rmdir /s /q "app\api\dept-manager"
    echo   OK
)

if exist "app\api\check-create-packer" (
    echo [DELETE] app\api\check-create-packer
    rmdir /s /q "app\api\check-create-packer"
    echo   OK
)

if exist "app\api\debug-packer" (
    echo [DELETE] app\api\debug-packer
    rmdir /s /q "app\api\debug-packer"
    echo   OK
)

if exist "app\api\reports" (
    echo [DELETE] app\api\reports
    rmdir /s /q "app\api\reports"
    echo   OK
)

REM Delete team leader auth
if exist "app\api\auth\team-leader-login" (
    echo [DELETE] app\api\auth\team-leader-login
    rmdir /s /q "app\api\auth\team-leader-login"
    echo   OK
)

if exist "app\api\auth\team-leader-logout" (
    echo [DELETE] app\api\auth\team-leader-logout
    rmdir /s /q "app\api\auth\team-leader-logout"
    echo   OK
)

if exist "app\api\auth\team-leader-change-password" (
    echo [DELETE] app\api\auth\team-leader-change-password
    rmdir /s /q "app\api\auth\team-leader-change-password"
    echo   OK
)

REM Delete barcode scanner
if exist "components\barcode-scanner.tsx" (
    echo [DELETE] components\barcode-scanner.tsx
    del "components\barcode-scanner.tsx"
    echo   OK
)

echo.
echo ========================================
echo   Deletion Complete!
echo ========================================
echo.
echo Next Steps:
echo 1. Apply database migration in Supabase SQL Editor
echo    File: supabase\migrations\062_simplify_to_two_roles.sql
echo.
echo 2. Update navigation/sidebar component
echo    Remove links to deleted pages
echo.
echo 3. Test the system:
echo    npm run dev
echo.
echo 4. Review: SIMPLIFICATION_COMPLETE.md
echo.
pause

