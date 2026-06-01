# Trade History Filter System

This document outlines the professional filtering and analytics system implemented for the Synapse Trade History page.

## 1. Date Range Presets & Math Calculations
The system calculates date boundaries relative to the current local server time. The filtering supports the following presets:

- **All Time**: No date filters applied.
- **Today**: Displays trades opened from the start of the current day (`00:00:00.000`).
- **Yesterday**: Displays trades opened between the start of yesterday (`00:00:00.000`) and the end of yesterday (`23:59:59.999`).
- **Last 7 Days**: Displays trades opened within the last 7 calendar days.
- **Last 30 Days**: Displays trades opened within the last 30 calendar days.
- **This Month**: Displays trades opened from the 1st of the current month.
- **Last Month**: Displays trades opened between the 1st of the previous month and the last day of the previous month.
- **This Year**: Displays trades opened from January 1st of the current year.
- **Last Year**: Displays trades opened between January 1st and December 31st of the previous year.
- **Custom Range**: Filters using user-selected `startDate` and `endDate` fields. The end date is automatically extended to `23:59:59.999` to include trades executed on that day.

## 2. Analytics Calculation Metrics
All statistics cards at the top of the Trade History page are derived directly from the filtered trade list rather than the full database dataset. This guarantees immediate visual synchronization:

- **Volume Metrics**: Total trade counts (active + closed) matching criteria, alongside an active trade badge.
- **Win/Loss Ratio**: Calculated exclusively on closed trades within the filtered subset.
- **Net Profitability**: Cumulative sum of net profit/losses (PnL) and average ROI across the filtered trades.
- **Extreme Outliers**: Identifies the best and worst trades based on PnL from the closed set matching current filters.

## 3. Performance & Optimization
- **`useMemo` Hooks**: Used for computing `unifiedTrades`, `filterOptions`, `filteredTrades`, and `stats` variables to prevent redundant computations on component re-renders unless their specific dependencies change.
- **Custom Dropdowns**: An custom-styled, interactive dropdown (`FilterDropdown`) is built in React to bypass default HTML `<select>` styling limitations. It fully complies with the specified theme color codes (Background `#0f172a`, Border `#1e293b`, Selected `#2563eb`).
