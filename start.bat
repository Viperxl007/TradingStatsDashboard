@echo off
echo Starting Trading Stats Dashboard with Options Earnings Screener...
echo.

echo Step 1: Setting up Python virtual environment...
if not exist backend\venv (
    echo Creating virtual environment...
    cd backend
    python -m venv venv
    cd ..
) else (
    echo Virtual environment already exists.
)

echo Step 2: Starting the backend server...
start cmd /k "cd backend && venv\Scripts\activate && python -m pip install --upgrade pip && (python -m pip install -r requirements.txt || python -m pip install --user -r requirements.txt) && echo. && echo If you encounter dependency errors, try: python -m pip install --user Flask Flask-CORS yfinance scipy numpy && echo. && python run.py"

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