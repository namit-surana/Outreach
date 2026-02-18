@echo off
cd /d "%~dp0"

echo Starting YC Outreach...
echo.

echo Starting backend...
cd backend
start /min "YC-Backend" cmd /k "pip install -r requirements.txt && python main.py"
cd ..

echo Starting frontend...
cd frontend
start /min "YC-Frontend" cmd /k "npm install && npm run dev"

echo.
echo Waiting for frontend to start...
timeout /t 8 /nobreak >nul

echo Opening browser...
start http://localhost:5173

echo.
echo YC Outreach is running!
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Close this window anytime - servers keep running in background.
