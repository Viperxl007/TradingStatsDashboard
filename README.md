# Trading Stats Dashboard

A modern, interactive dashboard for analyzing trading statistics, importing data from spreadsheets, and providing performance insights.

![Trading Stats Dashboard](https://via.placeholder.com/800x450?text=Trading+Stats+Dashboard)

## Overview

The Trading Stats Dashboard is a powerful tool for traders to analyze their trading performance. It allows users to import trade data from Excel spreadsheets, visualize performance metrics, identify trends, and gain insights into their trading strategies.

### Key Features

- **Data Import**: Import trade data from Excel spreadsheets with automatic duplicate filtering
- **Account Summary**: View high-level metrics of your trading account
- **Token Analysis**: Analyze performance of individual tokens
- **Performance Tracking**: Track profit/loss over time with interactive charts
- **Trend Identification**: Identify trending tokens and market patterns
- **Filtering**: Filter data by token, date range, and trade type
- **Modern UI/UX**: Clean, responsive design with dark/light mode support
- **Responsive Charts**: Interactive visualizations for better data analysis
- **Performance Optimization**: Fast loading and rendering even with large datasets

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher) or yarn (v1.22 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/trading-stats-dashboard.git
   cd trading-stats-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```bash
   npm start
   # or
   yarn start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### Data Import Format

When using this tool, you'll need to prepare your trading data in a specific format. The application currently expects a structured Excel (.xlsx) or CSV file with the following columns:

**Required Columns:**
- `id`: Unique identifier for the trade
- `token`: Token/cryptocurrency symbol
- `date`: Date of the trade (YYYY-MM-DD format)
- `type`: Trade type ('buy' or 'sell')
- `amount`: Quantity of tokens traded
- `price`: Price per token in USD
- `profitLoss`: Profit/loss for this trade (if applicable)
- `fees`: Transaction fees

**Optional Columns:**
- `totalValue`: Total value of the trade (will be calculated if not provided)

> **Note:** Future versions may support more flexible import formats, but the current version requires this specific structure. If your data is in a different format, you'll need to reformat it before importing.

## Usage

### Importing Data

1. Click the "Import" button in the dashboard header
2. Select an Excel (.xlsx) or CSV file containing your trade data
3. The dashboard will automatically process the data and filter out duplicates
4. View your trading statistics in the dashboard

Make sure your data file follows the required format described in the "Data Import Format" section above. The application will validate your data during import and notify you of any formatting issues.

Example:

| id | token | date | type | amount | price | profitLoss | fees |
|----|-------|------|------|--------|-------|------------|------|
| 1 | BTC | 2023-01-15 | buy | 0.5 | 20000 | 0 | 10 |
| 2 | ETH | 2023-01-16 | buy | 5 | 1500 | 0 | 7.5 |
| 3 | BTC | 2023-01-20 | sell | 0.5 | 21000 | 500 | 10.5 |

### Filtering Data

Use the filter controls to narrow down your data:

- **Token Filter**: Select specific tokens to analyze
- **Date Range**: Filter trades within a specific time period
- **Trade Type**: Filter by buy or sell trades
- **Time Period**: Quick filters for common time periods (week, month, year, etc.)

All filters can be combined and will update the visualizations in real-time.

### Analyzing Performance

The dashboard provides various views to analyze your trading performance:

- **Summary**: High-level overview of your trading account
- **Performance**: Detailed performance analysis with charts
  - Line charts for profit/loss over time
  - Bar charts for comparing token performance
  - Calendar view for daily performance
- **Tokens**: Token-specific analysis and comparison
- **Trends**: Identification of trending tokens and patterns
- **History**: Detailed trade history and individual trade analysis

### UI Features

- **Dark/Light Mode**: Toggle between dark and light themes using the theme switch in the header
- **Responsive Design**: The dashboard adapts to different screen sizes
- **Interactive Charts**: Hover over charts to see detailed information
- **Tooltips**: Informative tooltips throughout the interface
- **Sorting**: Sort data tables by different columns
- **Pagination**: Navigate through large datasets with pagination controls

## Project Structure

```
trading-stats-dashboard/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── HistoryView.tsx
│   │   ├── PerformanceAnalysis.tsx
│   │   ├── Summary.tsx
│   │   ├── TokenFilter.tsx
│   │   ├── TokensView.tsx
│   │   └── TrendsView.tsx
│   ├── context/
│   │   └── DataContext.tsx
│   ├── services/
│   │   ├── dataImport.ts
│   │   ├── dataProcessing.ts
│   │   └── loadExampleData.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   └── index.ts
│   ├── theme/
│   │   └── index.ts
│   ├── App.tsx
│   ├── index.css
│   └── index.tsx
├── implementation-plan.md
├── technical-specification.md
├── wireframe.md
├── project-roadmap.md
├── tsconfig.json
├── package.json
├── .gitignore
└── README.md
```

## Technology Stack

- **React**: Frontend library for building user interfaces
- **TypeScript**: Type-safe JavaScript
- **Chakra UI**: Modern component library for the UI
- **Recharts**: Charting library for data visualization
- **xlsx**: Library for parsing Excel files
- **React Context API**: State management
- **date-fns**: Date manipulation library
- **Lodash**: Utility functions

## Development

### Available Scripts

- `npm start`: Runs the app in development mode
- `npm test`: Launches the test runner
- `npm run build`: Builds the app for production
- `npm run eject`: Ejects from Create React App

### Project Documentation

The project includes several planning documents:

- **Implementation Plan**: Overall implementation strategy and phases
- **Technical Specification**: Detailed technical specifications
- **Wireframes**: UI/UX design wireframes
- **Project Roadmap**: Timeline and milestones

## Troubleshooting

### Common Issues

#### Data Import Issues

- **Issue**: Excel file not importing correctly
  - **Solution**: Ensure your Excel file follows the required format with all necessary columns
  - **Solution**: Check for special characters or formatting in your Excel file

- **Issue**: Duplicate trades appearing
  - **Solution**: The system identifies duplicates based on the `id` field. Ensure each trade has a unique ID

#### UI Display Issues

- **Issue**: Charts not displaying correctly
  - **Solution**: Ensure you have sufficient data for the selected time period
  - **Solution**: Try refreshing the page or clearing browser cache

- **Issue**: Dark mode text readability problems
  - **Solution**: The application should automatically adjust text colors for dark mode. If you encounter any readability issues, please report them

#### Performance Issues

- **Issue**: Slow performance with large datasets
  - **Solution**: The application is optimized for datasets up to 10,000 trades. For larger datasets, consider filtering by date range to improve performance

### Browser Compatibility

The dashboard is tested and optimized for:
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Edge (latest 2 versions)
- Safari (latest 2 versions)

## Recent Updates

- Improved filter button alignment in the Performance Analysis component
- Fixed tooltip text color in dark mode for better readability
- Enhanced chart responsiveness and interaction
- Added comprehensive documentation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [React](https://reactjs.org/)
- [Chakra UI](https://chakra-ui.com/)
- [Recharts](https://recharts.org/)
- [xlsx](https://github.com/SheetJS/sheetjs)