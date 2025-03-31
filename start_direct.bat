@echo off
echo Starting Trading Stats Dashboard with Options Earnings Screener (Direct Mode)...
echo.
echo This script runs without using virtual environments and includes all necessary code.
echo.

echo Step 1: Installing minimal required dependencies...
python -m pip install --user Flask Flask-CORS yfinance numpy scipy finance-calendars==0.0.7 pandas
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Warning: Some dependencies could not be installed.
    echo The application will try to run with available packages.
    echo.
    pause
)

echo Step 2: Starting the backend server...
start cmd /k "cd backend && python run_direct.py"

echo Waiting for backend server to initialize...
timeout /t 5 /nobreak > nul

echo Step 3: Starting the frontend application...
start cmd /k "npm install && npm start"

echo.
echo Both servers should now be starting in separate windows.
echo.
echo IMPORTANT: The backend server must be running for the Options Earnings Screener to work.
echo If you encounter any issues, please refer to the README.md file for troubleshooting steps.
echo.
echo Press any key to exit this window...
pause > nul