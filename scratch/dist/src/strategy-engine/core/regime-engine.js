export class RegimeEngine {
    /**
     * Evaluates technical indicator metrics to determine the current market regime.
     * Detects exactly: TRENDING, RANGING, HIGH_VOLATILITY, LOW_VOLATILITY.
     */
    static classify(context) {
        const { candles, indicators } = context;
        if (candles.length < 14)
            return "RANGING";
        const lastIdx = candles.length - 1;
        const price = candles[lastIdx].close;
        // 1. Calculate Bollinger Bands width and average width
        const bbUpper = indicators.bbUpper?.[lastIdx];
        const bbLower = indicators.bbLower?.[lastIdx];
        const bbMiddle = indicators.bbMiddle?.[lastIdx];
        let bbWidth = 0.05;
        let avgBbWidth = 0.05;
        if (bbUpper && bbLower && bbMiddle) {
            bbWidth = (bbUpper - bbLower) / bbMiddle;
            let widthSum = 0;
            let count = 0;
            const start = Math.max(0, lastIdx - 20);
            for (let i = start; i <= lastIdx; i++) {
                const u = indicators.bbUpper?.[i];
                const l = indicators.bbLower?.[i];
                const m = indicators.bbMiddle?.[i];
                if (u && l && m) {
                    widthSum += (u - l) / m;
                    count++;
                }
            }
            avgBbWidth = count > 0 ? widthSum / count : bbWidth;
        }
        // 2. Check EMA Slope over last 5 candles
        const ema20Last = indicators.ema20?.[lastIdx];
        const ema20Prev = indicators.ema20?.[Math.max(0, lastIdx - 5)] ?? ema20Last;
        const emaSlope = ema20Last ? (ema20Last - ema20Prev) / ema20Last : 0;
        // 3. Volume confirmation
        const volume = candles[lastIdx].volume;
        const volumeMA = indicators.volumeMA?.[lastIdx] ?? 0;
        const isVolumeExpanding = volumeMA > 0 && volume > volumeMA * 1.5;
        // 4. ADX and ATR
        const adx = indicators.adx?.[lastIdx] ?? 0;
        const atr = indicators.atr?.[lastIdx] ?? (price * 0.015);
        // Classification decision tree
        // A. Volatility Extremes: Low Volatility (Squeeze)
        if (bbWidth < avgBbWidth * 0.75) {
            return "LOW_VOLATILITY";
        }
        // B. Volatility Extremes: High Volatility (Expansion)
        if (bbWidth > avgBbWidth * 1.3 || (bbWidth > avgBbWidth * 1.15 && isVolumeExpanding)) {
            return "HIGH_VOLATILITY";
        }
        // C. Trending (Strong trend confirmed by ADX & EMA/SMA slope)
        const sma50 = indicators.sma50?.[lastIdx];
        if (adx > 25 && ema20Last && sma50) {
            if ((price > ema20Last && ema20Last > sma50 && emaSlope > 0.0002) ||
                (price < ema20Last && ema20Last < sma50 && emaSlope < -0.0002)) {
                return "TRENDING";
            }
        }
        // D. Default Sideways Ranging Channel
        return "RANGING";
    }
    static getRegimeCategory(context) {
        const regime = this.classify(context);
        if (regime === "TRENDING")
            return "TRENDING";
        if (regime === "HIGH_VOLATILITY")
            return "BREAKOUT";
        if (regime === "LOW_VOLATILITY")
            return "RANGING";
        return "RANGING";
    }
}
