@echo off
echo Starting YC Outreach Application...

echo.
echo === Starting Backend Server ===
start cmd /k "cd /d C:\Users\hp\.openclaw\workspace\projects\job-hunt\yc-outreach\backend && python main.py"

echo.
echo === Starting Frontend Server ===
start cmd /k "cd /d C:\Users\hp\.openclaw\workspace\projects\job-hunt\yc-outreach\frontend && npm run dev"

echo.
echo === YC Outreach Launched ===
echo Backend and Frontend servers are starting...
echo The application will open in your browser automatically when ready.
echo Please do not close this window until you're done using the application.

timeout /t 5
exit