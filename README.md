# Trading Stats Dashboard

A dashboard for analyzing trading statistics, importing data from spreadsheets, and providing performance insights.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- pnpm (v6 or higher)
- Python (v3.8 or higher)

### Installation

1. Install frontend dependencies:
   ```
   pnpm install
   ```

2. Install backend dependencies:
   ```
   cd backend
   python -m pip install -r requirements.txt
   cd ..
   ```

## Running the Application

### Integrated Start (Recommended)

To start both the frontend and backend services with a single command:

```
pnpm start
```

This will start:
- The React frontend on http://localhost:3000
- The Flask backend on http://localhost:5000

### Alternative Start Methods

#### Start with Direct Backend

If you prefer to use the direct backend implementation (without virtual environments):

```
pnpm start:direct
```

#### Start Frontend Only

```
pnpm start:frontend
```

#### Start Backend Only

```
pnpm start:backend
```

or for the direct backend:

```
pnpm start:backend:direct
```

## Features

- Import trading data from spreadsheets
- Analyze trading performance
- View historical trends
- Options earnings screener
- Earnings history analysis

## License

This project is licensed under the MIT License - see the LICENSE file for details.