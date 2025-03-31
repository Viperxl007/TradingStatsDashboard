# Options Earnings Screener Backend

This is the backend service for the Options Earnings Screener feature of the Trading Stats Dashboard.

## Overview

This Flask-based API service provides endpoints for analyzing options data and scanning for earnings plays. It leverages the yfinance library for market data and the finance_calendars library for earnings announcements.

## Features

- **Options Analysis** - Analyze options data for a specific ticker
- **Earnings Scanner** - Scan stocks with earnings announcements for potential plays
- **Earnings Calendar** - Get a list of stocks with earnings announcements

## API Endpoints

### Health Check
```
GET /api/health
```
Returns the health status of the API.

### Analyze Options
```
GET /api/analyze/{ticker}
```
Analyzes options data for a specific ticker and provides a recommendation.

**Parameters:**
- `ticker` (path parameter) - Stock ticker symbol (e.g., AAPL, MSFT)

**Response:**
```json
{
  "ticker": "AAPL",
  "currentPrice": 175.25,
  "metrics": {
    "avgVolume": 65000000,
    "avgVolumePass": true,
    "iv30Rv30": 1.35,
    "iv30Rv30Pass": true,
    "tsSlope": -0.00512,
    "tsSlopePass": true
  },
  "expectedMove": "4.2%",
  "recommendation": "Recommended",
  "timestamp": 1648123456789
}
```

### Scan Earnings
```
GET /api/scan/earnings
```
Scans stocks with earnings announcements for the current day.

**Query Parameters:**
- `date` (optional) - Date in YYYY-MM-DD format. Defaults to today.

**Response:**
```json
{
  "date": "2025-03-24",
  "count": 15,
  "results": [
    {
      "ticker": "AAPL",
      "companyName": "Apple Inc.",
      "currentPrice": 175.25,
      "metrics": {
        "avgVolume": 65000000,
        "avgVolumePass": true,
        "iv30Rv30": 1.35,
        "iv30Rv30Pass": true,
        "tsSlope": -0.00512,
        "tsSlopePass": true
      },
      "expectedMove": "4.2%",
      "recommendation": "Recommended",
      "reportTime": "AMC",
      "timestamp": 1648123456789
    },
    // More results...
  ],
  "timestamp": 1648123456789
}
```

### Get Earnings Calendar
```
GET /api/calendar/today
```
Gets a list of companies reporting earnings today.

**Response:**
```json
{
  "date": "2025-03-24",
  "count": 25,
  "earnings": [
    {
      "ticker": "AAPL",
      "companyName": "Apple Inc.",
      "reportTime": "AMC",
      "date": "2025-03-24",
      "estimatedEPS": 1.43,
      "actualEPS": null
    },
    // More earnings...
  ],
  "timestamp": 1648123456789
}
```

```
GET /api/calendar/{date}
```
Gets a list of companies reporting earnings on a specific date.

**Parameters:**
- `date` (path parameter) - Date in YYYY-MM-DD format

## Project Structure

```
backend/
├── app/
│   ├── __init__.py          # Flask app initialization
│   ├── routes.py            # API routes
│   ├── options_analyzer.py  # Options analysis logic
│   ├── data_fetcher.py      # Market data fetching
│   └── earnings_calendar.py # Earnings calendar functions
├── requirements.txt         # Python dependencies
├── run.py                   # Entry point
└── Dockerfile               # Docker configuration
```

## Installation

1. Create a virtual environment (optional but recommended):
   ```bash
   # On Windows
   python -m venv venv
   venv\Scripts\activate

   # On macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Service

### Development Mode

```bash
python run.py
```

The service will start on http://localhost:5000

### Production Mode

For production deployment, it's recommended to use Gunicorn:

```bash
gunicorn --bind 0.0.0.0:5000 run:app
```

### Docker

Build and run using Docker:

```bash
docker build -t options-earnings-backend .
docker run -p 5000:5000 options-earnings-backend
```

## Environment Variables

The service can be configured using the following environment variables:

- `PORT` - Port to run the service on (default: 5000)
- `FLASK_ENV` - Environment mode (development or production)
- `SECRET_KEY` - Secret key for the Flask app

## Dependencies

- Flask - Web framework
- Flask-CORS - Cross-Origin Resource Sharing support
- yfinance - Yahoo Finance market data
- finance-calendars - Earnings calendar data
- scipy - Scientific computing
- numpy - Numerical computing

## Development

### Adding New Endpoints

1. Define the endpoint in `app/routes.py`
2. Implement the necessary logic in the appropriate module
3. Update the API documentation

### Testing

Run tests using pytest:

```bash
pytest
```

## Troubleshooting

### Common Issues

- **API Rate Limiting**: The yfinance and finance_calendars libraries may be subject to rate limiting. Consider implementing caching or rate limiting in production.
- **Market Hours**: Some data may only be available during market hours.
- **Data Accuracy**: Financial data may have delays or inaccuracies. Always verify critical information.

### Logs

Check the logs for detailed error information:

```bash
tail -f app.log