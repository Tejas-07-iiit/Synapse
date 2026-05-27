import { StrategyContext } from "../types";

export interface AIMarketSummaryResult {
  summary: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  riskLevel: "LOW" | "MODERATE" | "HIGH";
  keyLevels: {
    support: number[];
    resistance: number[];
  };
}

export class AIMarketSummaryPreparer {
  /**
   * Prepares context payload for generating general summaries.
   */
  public static prepareSummaryPrompt(context: StrategyContext): string {
    const lastIdx = context.candles.length - 1;
    const currentPrice = context.candles[lastIdx]?.close || 0;
    return `
Synthesize a market summary for ${context.symbol} (${context.timeframe}).
Current Price: $${currentPrice.toFixed(2)}
ATR Volatility: ${context.indicators.atr[lastIdx]?.toFixed(4)}
RSI oscillator: ${context.indicators.rsi[lastIdx]?.toFixed(1)}
Provide key support/resistance levels, current macro risk, and a bulleted summary.
`;
  }

  /**
   * Stub for summary generation.
   */
  public static async invokeLLMSummary(context: StrategyContext): Promise<AIMarketSummaryResult> {
    const lastIdx = context.candles.length - 1;
    const currentPrice = context.candles[lastIdx]?.close || 0;
    const atr = context.indicators.atr[lastIdx] || (currentPrice * 0.015);

    return {
      summary: `Asset ${context.symbol} is trading inside volatile zones. Volatility is measured at an ATR of $${atr.toFixed(2)}. Trend supports intermediate levels.`,
      sentiment: context.indicators.rsi[lastIdx] > 55 ? "BULLISH" : (context.indicators.rsi[lastIdx] < 45 ? "BEARISH" : "NEUTRAL"),
      riskLevel: atr / currentPrice > 0.02 ? "HIGH" : "MODERATE",
      keyLevels: {
        support: [Number((currentPrice - atr).toFixed(2)), Number((currentPrice - 2 * atr).toFixed(2))],
        resistance: [Number((currentPrice + atr).toFixed(2)), Number((currentPrice + 2 * atr).toFixed(2))],
      },
    };
  }
}
