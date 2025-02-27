# Trading Stats Dashboard - Wireframes

This document provides text-based wireframes to illustrate the layout and components of the Trading Stats Dashboard.

## Dashboard Layout

```
+----------------------------------------------------------------------+
|                        TRADING STATS DASHBOARD                        | <- Header
+----------------------------------------------------------------------+
|  [Import]  [Export]  [Settings]                      [🌙 Dark Mode]  | <- Controls
+----------------------------------------------------------------------+
|  [Summary]  [Performance]  [Tokens]  [Trends]  [History]             | <- Navigation Tabs
+----------------------------------------------------------------------+
|                                                                      |
|  +------------------------+  +----------------------------------+    |
|  |  ACCOUNT SUMMARY       |  |  PERFORMANCE OVER TIME           |    |
|  |                        |  |                                  |    |
|  |  Total Trades: 245     |  |  [Line Chart showing P/L over    |    |
|  |  Total P/L: $12,450    |  |   time with selectable tokens]   |    |
|  |  Win Rate: 68%         |  |                                  |    |
|  |  Avg P/L: $50.82       |  |                                  |    |
|  +------------------------+  +----------------------------------+    |
|                                                                      |
|  +------------------------+  +----------------------------------+    |
|  |  TOP PERFORMING        |  |  RECENT ACTIVITY                 |    |
|  |                        |  |                                  |    |
|  |  1. ETH  +15.2%        |  |  [Table of recent trades with    |    |
|  |  2. BTC  +12.1%        |  |   token, type, amount, P/L]      |    |
|  |  3. SOL  +8.7%         |  |                                  |    |
|  |  4. AVAX +6.2%         |  |                                  |    |
|  +------------------------+  +----------------------------------+    |
|                                                                      |
+----------------------------------------------------------------------+
```

## Summary Tab

```
+----------------------------------------------------------------------+
|                        TRADING STATS DASHBOARD                        |
+----------------------------------------------------------------------+
|  [Import]  [Export]  [Settings]                      [🌙 Dark Mode]  |
+----------------------------------------------------------------------+
|  [Summary]  [Performance]  [Tokens]  [Trends]  [History]             |
+----------------------------------------------------------------------+
|                                                                      |
|  +------------------------+  +------------------------+  +---------+ |
|  |  TOTAL TRADES          |  |  TOTAL PROFIT/LOSS     |  |  WIN    | |
|  |                        |  |                        |  |  RATE    | |
|  |  245                   |  |  $12,450               |  |          | |
|  |  [mini chart]          |  |  [mini chart]          |  |   68%    | |
|  |  +12% from last month  |  |  +8% from last month   |  |  [chart] | |
|  +------------------------+  +------------------------+  +---------+ |
|                                                                      |
|  +----------------------------------+  +------------------------+    |
|  |  MONTHLY PERFORMANCE             |  |  TOP TOKENS BY P/L     |    |
|  |                                  |  |                        |    |
|  |  [Bar chart showing monthly      |  |  [Horizontal bar chart |    |
|  |   performance with profit/loss]  |  |   showing top tokens]  |    |
|  |                                  |  |                        |    |
|  |                                  |  |                        |    |
|  +----------------------------------+  +------------------------+    |
|                                                                      |
|  +--------------------------------------------------------------+    |
|  |  PERFORMANCE BY TIMEFRAME                                    |    |
|  |                                                              |    |
|  |  [Table showing performance metrics for different timeframes]|    |
|  |  Today | This Week | This Month | This Quarter | This Year   |    |
|  |                                                              |    |
|  +--------------------------------------------------------------+    |
|                                                                      |
+----------------------------------------------------------------------+
```

## Performance Tab

```
+----------------------------------------------------------------------+
|                        TRADING STATS DASHBOARD                        |
+----------------------------------------------------------------------+
|  [Import]  [Export]  [Settings]                      [🌙 Dark Mode]  |
+----------------------------------------------------------------------+
|  [Summary]  [Performance]  [Tokens]  [Trends]  [History]             |
+----------------------------------------------------------------------+
|                                                                      |
|  +--------------------------------------------------------------+    |
|  |  FILTERS                                                     |    |
|  |  Tokens: [Dropdown] Date Range: [Date Picker] Type: [Dropdown]    |
|  +--------------------------------------------------------------+    |
|                                                                      |
|  +--------------------------------------------------------------+    |
|  |  PERFORMANCE OVER TIME                                       |    |
|  |                                                              |    |
|  |  [Line chart showing cumulative P/L over time with           |    |
|  |   ability to compare multiple tokens]                        |    |
|  |                                                              |    |
|  |                                                              |    |
|  +--------------------------------------------------------------+    |
|                                                                      |
|  +------------------------+  +----------------------------------+    |
|  |  TRADE DISTRIBUTION    |  |  WIN/LOSS RATIO                  |    |
|  |                        |  |                                  |    |
|  |  [Pie chart showing    |  |  [Stacked bar chart showing      |    |
|  |   distribution of      |  |   winning vs losing trades       |    |
|  |   trades by token]     |  |   by token]                      |    |
|  |                        |  |                                  |    |
|  +------------------------+  +----------------------------------+    |
|                                                                      |
+----------------------------------------------------------------------+
```

## Tokens Tab

```
+----------------------------------------------------------------------+
|                        TRADING STATS DASHBOARD                        |
+----------------------------------------------------------------------+
|  [Import]  [Export]  [Settings]                      [🌙 Dark Mode]  |
+----------------------------------------------------------------------+
|  [Summary]  [Performance]  [Tokens]  [Trends]  [History]             |
+----------------------------------------------------------------------+
|                                                                      |
|  +--------------------------------------------------------------+    |
|  |  FILTERS                                                     |    |
|  |  Search: [____________________] Sort By: [Dropdown]          |    |
|  +--------------------------------------------------------------+    |
|                                                                      |
|  +--------------------------------------------------------------+    |
|  |  TOKEN PERFORMANCE TABLE                                     |    |
|  |                                                              |    |
|  |  Token | Trades | Volume | Avg P/L | Win Rate | Trend        |    |
|  |  --------------------------------------------------          |    |
|  |  BTC   | 45     | $120K  | $78.25  | 72%      | ↗️ +5.2%     |    |
|  |  ETH   | 62     | $85K   | $65.10  | 68%      | ↗️ +8.7%     |    |
|  |  SOL   | 38     | $42K   | $45.75  | 65%      | ↗️ +12.3%    |    |
|  |  AVAX  | 29     | $28K   | $38.20  | 62%      | ↘️ -2.1%     |    |
|  |  ...   | ...    | ...    | ...     | ...      | ...          |    |
|  |                                                              |    |
|  +--------------------------------------------------------------+    |
|                                                                      |
|  +--------------------------------------------------------------+    |
|  |  TOKEN DETAILS (appears when a token is selected)            |    |
|  |                                                              |    |
|  |  [Detailed metrics and charts for the selected token]        |    |
|  |  - Performance over time                                     |    |
|  |  - Trade history                                             |    |
|  |  - Buy/sell distribution                                     |    |
|  |  - Holding time analysis                                     |    |
|  +--------------------------------------------------------------+    |
|                                                                      |
+----------------------------------------------------------------------+
```

## Trends Tab

```
+----------------------------------------------------------------------+
|                        TRADING STATS DASHBOARD                        |
+----------------------------------------------------------------------+
|  [Import]  [Export]  [Settings]                      [🌙 Dark Mode]  |
+----------------------------------------------------------------------+
|  [Summary]  [Performance]  [Tokens]  [Trends]  [History]             |
+----------------------------------------------------------------------+
|                                                                      |
|  +------------------------+  +----------------------------------+    |
|  |  TRENDING UP           |  |  TRENDING DOWN                   |    |
|  |                        |  |                                  |    |
|  |  [Cards showing tokens |  |  [Cards showing tokens with      |    |
|  |   with positive trends]|  |   negative trends]               |    |
|  |                        |  |                                  |    |
|  |  SOL   ↗️ +12.3%       |  |  AVAX  ↘️ -2.1%                  |    |
|  |  ETH   ↗️ +8.7%        |  |  DOT   ↘️ -3.5%                  |    |
|  |  BTC   ↗️ +5.2%        |  |  LINK  ↘️ -4.2%                  |    |
|  +------------------------+  +----------------------------------+    |
|                                                                      |
|  +--------------------------------------------------------------+    |
|  |  VOLATILITY ANALYSIS                                         |    |
|  |                                                              |    |
|  |  [Scatter plot showing tokens by volatility and performance] |    |
|  |                                                              |    |
|  |                                                              |    |
|  +--------------------------------------------------------------+    |
|                                                                      |
|  +--------------------------------------------------------------+    |
|  |  PERFORMANCE HEATMAP                                         |    |
|  |                                                              |    |
|  |  [Heatmap showing performance by token and time period]      |    |
|  |                                                              |    |
|  |                                                              |    |
|  +--------------------------------------------------------------+    |
|                                                                      |
+----------------------------------------------------------------------+
```

## History Tab

```
+----------------------------------------------------------------------+
|                        TRADING STATS DASHBOARD                        |
+----------------------------------------------------------------------+
|  [Import]  [Export]  [Settings]                      [🌙 Dark Mode]  |
+----------------------------------------------------------------------+
|  [Summary]  [Performance]  [Tokens]  [Trends]  [History]             |
+----------------------------------------------------------------------+
|                                                                      |
|  +--------------------------------------------------------------+    |
|  |  FILTERS                                                     |    |
|  |  Token: [Dropdown] Date: [Date Picker] Type: [Dropdown]      |    |
|  +--------------------------------------------------------------+    |
|                                                                      |
|  +--------------------------------------------------------------+    |
|  |  TRADE HISTORY                                               |    |
|  |                                                              |    |
|  |  Date       | Token | Type  | Amount | Price  | P/L    | Fees    |
|  |  ----------------------------------------------------------  |    |
|  |  2023-02-15 | BTC   | Buy   | 0.5    | $24,500| -      | $12.25  |
|  |  2023-02-14 | ETH   | Sell  | 2.0    | $1,650 | +$120  | $8.25   |
|  |  2023-02-12 | SOL   | Buy   | 15.0   | $22.75 | -      | $6.80   |
|  |  2023-02-10 | ETH   | Buy   | 2.0    | $1,590 | -      | $7.95   |
|  |  ...        | ...   | ...   | ...    | ...    | ...    | ...     |
|  |                                                              |    |
|  +--------------------------------------------------------------+    |
|                                                                      |
|  +--------------------------------------------------------------+    |
|  |  TRADE DETAILS (appears when a trade is selected)            |    |
|  |                                                              |    |
|  |  [Detailed information about the selected trade]             |    |
|  |  - Complete trade data                                       |    |
|  |  - Related trades (if part of a sequence)                    |    |
|  |  - Notes and annotations                                     |    |
|  +--------------------------------------------------------------+    |
|                                                                      |
+----------------------------------------------------------------------+
```

## Mobile View (Responsive Design)

```
+---------------------------+
|   TRADING STATS DASHBOARD |
+---------------------------+
| [☰ Menu]        [🌙 Mode] |
+---------------------------+
| [Summary] [Perf] [Tokens] |
+---------------------------+
|                           |
| +-------------------------+
| | ACCOUNT SUMMARY         |
| |                         |
| | Total Trades: 245       |
| | Total P/L: $12,450      |
| | Win Rate: 68%           |
| +-------------------------+
|                           |
| +-------------------------+
| | PERFORMANCE OVER TIME   |
| |                         |
| | [Line Chart - simplified |
| |  for mobile view]       |
| |                         |
| +-------------------------+
|                           |
| +-------------------------+
| | TOP PERFORMING TOKENS   |
| |                         |
| | 1. ETH  +15.2%          |
| | 2. BTC  +12.1%          |
| | 3. SOL  +8.7%           |
| +-------------------------+
|                           |
+---------------------------+
```

## Component Design Details

### Card Component
```
+------------------------+
|  TITLE                 |  <- Bold header
|                        |
|  VALUE                 |  <- Large, prominent value
|  [visualization]       |  <- Optional chart/visualization
|  Context/comparison    |  <- Additional context
+------------------------+
```

### Chart Components

#### Line Chart
```
+----------------------------------+
|  CHART TITLE                     |
|                                  |
|  Y-axis                          |
|  labels    [Actual line chart    |
|            with multiple series, |
|            points, and tooltips] |
|                                  |
|            X-axis labels         |
+----------------------------------+
|  [Legend with toggleable series] |
+----------------------------------+
```

#### Bar Chart
```
+----------------------------------+
|  CHART TITLE                     |
|                                  |
|  Y-axis                          |
|  labels    [Vertical or          |
|            horizontal bars with  |
|            labels and values]    |
|                                  |
|            X-axis labels         |
+----------------------------------+
```

### Filter Component
```
+--------------------------------------------------------------+
|  FILTERS                                                     |
|                                                              |
|  Token:  [Dropdown ▼]  Date:  [Date Picker]  Type: [Dropdown ▼]  |
|  [Apply Filters]                           [Reset Filters]   |
+--------------------------------------------------------------+
```

### Table Component
```
+--------------------------------------------------------------+
|  TABLE TITLE                                                 |
|                                                              |
|  Column 1 ▼ | Column 2 ▼ | Column 3 ▼ | Column 4 ▼ | Column 5 ▼  |
|  ------------------------------------------------------------|
|  Value 1    | Value 2    | Value 3    | Value 4    | Value 5    |
|  Value 1    | Value 2    | Value 3    | Value 4    | Value 5    |
|  Value 1    | Value 2    | Value 3    | Value 4    | Value 5    |
|  ------------------------------------------------------------|
|  [Pagination controls]                                       |
+--------------------------------------------------------------+
```

## Design Notes

1. **Color Scheme**:
   - Primary brand color for headers and key UI elements
   - Green for profits and positive trends
   - Red for losses and negative trends
   - Neutral grays for background and non-emphasized elements
   - Dark mode with appropriate contrast

2. **Typography**:
   - Clean, modern sans-serif font (Inter)
   - Clear hierarchy with different weights and sizes
   - Consistent alignment and spacing

3. **Responsive Behavior**:
   - Cards stack vertically on smaller screens
   - Tables become scrollable horizontally
   - Navigation converts to hamburger menu
   - Charts simplify for smaller viewports

4. **Interactions**:
   - Hover states for interactive elements
   - Tooltips for additional information
   - Smooth transitions between states
   - Clear focus indicators for accessibility