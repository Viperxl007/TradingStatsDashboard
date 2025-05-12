# IV Differential Scoring Improvements

This document outlines the improvements made to the calendar spread scoring system to better weight IV differentials according to predefined thresholds.

## Background

Calendar spreads profit from IV differential between expiration dates and volatility crush after earnings. The system already had defined thresholds for what constitutes "good" and "ideal" IV differentials:

- **Good IV Differential**: 10% or higher
- **Ideal IV Differential**: 15% or higher

However, the original scoring system used a linear scaling for IV differential contribution to the overall score, which didn't properly reward spreads that met these important thresholds.

## Changes Made

### 1. Enhanced IV Differential Scoring

Modified the `calculate_spread_score` function in `options_analyzer.py` to add bonus points when the IV differential meets or exceeds the defined thresholds:

- **Base Score**: Still proportional to IV differential (linear scaling)
- **Bonus for Good IV Differential** (≥10%): Added 2.5 points in Monte Carlo path, 7.5 percentage points in traditional path
- **Bonus for Excellent IV Differential** (≥15%): Added 5 points in Monte Carlo path, 15 percentage points in traditional path

### 2. IV Quality Rating

Added a new `ivQuality` field to the result that provides a qualitative assessment of the IV differential:

- **"Excellent"**: IV differential ≥ 15%
- **"Good"**: IV differential ≥ 10% but < 15%
- **"Below threshold"**: IV differential < 10%

### 3. Frontend Display

Updated the `CalendarSpreadDisplay.tsx` component to display the IV quality rating alongside the IV differential percentage, with appropriate color coding:

- **Excellent**: Green
- **Good**: Blue
- **Below threshold**: Gray

### 4. Type Definitions

Updated the `OptimalCalendarSpread` interface in `types/index.ts` to include the new `ivQuality` field.

## Benefits

These changes provide several benefits:

1. **Better Scoring Alignment**: The scoring system now properly rewards calendar spreads that meet the established thresholds for good and ideal IV differentials.

2. **Clearer User Feedback**: Users can now see at a glance whether a calendar spread has a good or excellent IV differential, rather than having to interpret the raw percentage.

3. **More Accurate Strategy Ranking**: Calendar spreads with IV differentials that meet or exceed the thresholds will be ranked higher, leading to better strategy recommendations.

## Technical Implementation

The implementation uses a step function approach rather than a purely linear one:

```
if iv_differential >= IDEAL_IV_DIFFERENTIAL (0.15):
    Add significant bonus points
else if iv_differential >= GOOD_IV_DIFFERENTIAL (0.10):
    Add moderate bonus points
else:
    No bonus points
```

This ensures that strategies meeting the established thresholds receive appropriate recognition in the scoring system.