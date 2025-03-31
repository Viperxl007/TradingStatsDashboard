#!/bin/bash

echo "Starting Trading Stats Dashboard with Options Earnings Screener..."
echo

echo "Step 1: Setting up Python virtual environment..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
else
    echo "Virtual environment already exists."
fi

echo "Step 2: Starting the backend server..."
source venv/bin/activate
python -m pip install --upgrade pip

# Try installing with regular permissions first
python -m pip install -r requirements.txt

# If that fails, try with --user flag
if [ $? -ne 0 ]; then
    echo "Encountered permission issues. Trying with --user flag..."
    python -m pip install --user -r requirements.txt
fi

# Handle potential dependency issues
if [ $? -ne 0 ]; then
    echo "Encountered issues with dependencies. Trying minimal installation..."
    python -m pip install --user Flask Flask-CORS yfinance scipy numpy finance-calendars==0.0.7 pandas
fi

echo "Starting Flask server..."
python run.py &
BACKEND_PID=$!

echo "Waiting for backend server to initialize..."
sleep 5

echo "Step 3: Starting the frontend application..."
cd ..
npm install
npm start &
FRONTEND_PID=$!

echo
echo "Both servers are now running."
echo
echo "IMPORTANT: The backend server must be running for the Options Earnings Screener to work."
echo "If you encounter any issues, please refer to the README.md file for troubleshooting steps."
echo
echo "Press Ctrl+C to stop both servers."

# Handle cleanup when script is terminated
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM EXIT

# Wait for user to terminate
wait