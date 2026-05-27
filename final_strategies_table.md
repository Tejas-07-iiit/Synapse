# Final Strategies Table

| Strategy Name | Source System | Type | Complexity | Reusable? | Primary Indicators Used |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mean Reversion** | Legacy Node.js | Mean-Reversion | Low-Medium | Yes (Refactored) | RSI14, Volatility (10-bar), Support & Resistance (10-bar) |
| **Momentum Strategy** | Legacy Node.js | Momentum | Medium | Yes (Refactored) | RSI14, Trend, Momentum, EMA20, EMA50, MACD, Volatility |
| **Defensive Strategy** | Legacy Node.js | Trend-Following | Low-Medium | Yes (Refactored) | RSI14, Momentum, MACD, Support Level |
| **Grid Strategy** | Legacy Node.js | Grid / Range | Medium | Yes (Refactored) | RSI14, Volatility, Support & Resistance, EMA20/50, MACD |
| **Lorentzian Classification** | Framework Native | Statistical / ML | High | Yes (Highly) | RSI, ADX, CCI, WaveTrend, EMA200 (k-NN Lite) |
| **Bollinger Breakout** | Framework Native | Breakout | Medium | Yes | Bollinger Bands (20,2), ADX14 |
| **Donchian Breakout** | Framework Native | Breakout | Low | Yes | Donchian Channels (20), ADX14 |
| **Rally Base Drop** | Framework Native | Market-Structure | Medium | Yes | Supply/Demand Zones, High-Volume zones |
| **Support Resistance Sweep** | Framework Native | Market-Structure | Medium | Yes | Range High/Low 52, RSI14 |
| **Bollinger Reversion** | Framework Native | Mean-Reversion | Low | Yes | Bollinger Bands (20,2), ADX14, RSI14 |
| **Short Term Reversal** | Framework Native | Mean-Reversion | Low | Yes | RSI14, Momentum12, EMA50 |
| **Dow Factor MFI RSI** | Framework Native | Momentum | Medium | Yes | Dow theory swing high/low, RSI14, MFI14 |
| **Parabolic RSI** | Framework Native | Momentum | Medium | Yes | Parabolic SAR applied to RSI(14) |
| **Range Breakout High** | Framework Native | Momentum | Low | Yes | Range High/Low 52, EMA50 |
| **Residual Momentum** | Framework Native | Momentum | Low | Yes | Momentum12, EMA50, EMA200 |
| **Time Series Momentum** | Framework Native | Momentum | Low | Yes | Momentum12, ADX14 |
| **WaveTrend Oscillator** | Framework Native | Momentum | Medium | Yes | WaveTrend (LazyBear), EMA20 |
| **Hash Ribbons** | Framework Native | Sentiment | Medium | Optional | Hashrate SMA 30/60 (Crypto-specific) |
| **News Fear Greed** | Framework Native | Sentiment | High | Yes | News Sentiment, Fear/Greed Index |
| **EMA Cross ADX** | Framework Native | Trend-Following | Low | Yes | EMA20, EMA50, ADX14, MACD |
| **Golden Cross** | Framework Native | Trend-Following | Low | Yes | SMA50, SMA200 |
| **Heiken Ashi Swing** | Framework Native | Trend-Following | Medium | Yes | Heiken Ashi color flips (Slow confirmation) |
| **Hyper Supertrend** | Framework Native | Trend-Following | Medium | Yes | Supertrend (10, 2) + Supertrend (12, 3) |
| **Ichimoku Cloud** | Framework Native | Trend-Following | Medium | Yes | Tenkan, Kijun, Senkou Span A/B |
| **MA Crossover Variable** | Framework Native | Trend-Following | Low | Yes | EMA20, EMA50, SMA200 |
| **SMA Trend Filter** | Framework Native | Trend-Following | Low | Yes | SMA50, SMA200, RSI14 |
| **T3 Nexus** | Framework Native | Trend-Following | Medium | Yes | Tillson T3 Moving Average (8, 0.7) |
| **Squeeze Momentum** | Framework Native | Volatility | Medium | Yes | Bollinger Bands inside Keltner Channels |
| **Volatility Regime** | Framework Native | Volatility | Low | Yes | ATRPct, ADX14 |
| **Zeiierman Volatility** | Framework Native | Volatility | Medium | Yes | Volatility Bands, ADX14, Volume |
