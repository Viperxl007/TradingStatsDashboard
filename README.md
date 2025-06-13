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
- **AI-Powered Chart Analysis** - Analyze stock charts using Claude Vision AI
  - Technical pattern recognition
  - Support/resistance level detection
  - Trading recommendations and insights
  - Historical analysis tracking

## AI Chart Analysis Feature

The Trading Stats Dashboard now includes an AI-powered chart analysis feature that uses Claude Vision API to analyze stock charts and provide technical insights.

### Quick Setup

1. **Get Claude API Key**: Sign up at [Anthropic Console](https://console.anthropic.com/) and obtain an API key
2. **Configure API Key**: Set the environment variable:
   ```bash
   export CLAUDE_API_KEY="your_claude_api_key_here"
   ```
3. **Start the Application**: Use the standard start command:
   ```bash
   pnpm start
   ```

### Features

- **Technical Pattern Recognition**: Identify chart patterns like triangles, flags, and head & shoulders
- **Support/Resistance Detection**: AI-powered identification of key price levels
- **Trading Recommendations**: Entry points, exit targets, and stop-loss suggestions
- **Historical Analysis**: Track and compare previous analyses
- **Risk Assessment**: Automated risk-reward calculations

### Usage

1. Navigate to the AI Chart Analysis section
2. Enter a stock ticker symbol (e.g., AAPL, TSLA)
3. Upload a chart image or capture a screenshot
4. Review the AI-generated analysis and recommendations

### Documentation

- **[📚 Documentation Index](docs/AI_Chart_Analysis_Documentation_Index.md)** - Complete documentation overview
- **[👤 User Guide](docs/AI_Chart_Analysis_User_Guide.md)** - Complete user documentation
- **[⚙️ Setup Guide](docs/AI_Chart_Analysis_Setup_Guide.md)** - Installation and configuration
- **[🔌 API Documentation](docs/AI_Chart_Analysis_API_Documentation.md)** - Technical API reference
- **[🏗️ Architecture Overview](docs/AI_Chart_Analysis_Architecture.md)** - System design and architecture
- **[🔧 Maintenance Guide](docs/AI_Chart_Analysis_Maintenance_Guide.md)** - Operations and troubleshooting
- **[💻 Backend Documentation](backend/README_AI_CHART_ANALYSIS.md)** - Backend implementation details

## License

This project is licensed under the MIT License - see the LICENSE file for details.