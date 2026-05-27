import { StrategyContext } from "../types";

export interface AIRegimeAnalysisResult {
  regime: string;
  narrative: string;
  dominantIndicators: string[];
  recommendedStrategyIds: string[];
}

export class AIRegimeAnalysisPreparer {
  /**
   * Prepares the context prompt for regime analysis.
   */
  public static prepareRegimePrompt(context: StrategyContext, quantitativeRegime: string): string {
    const lastIdx = context.candles.length - 1;
    const lastCandle = context.candles[lastIdx];
    return `
Analyze the market regime for ${context.symbol} on the ${context.timeframe} timeframe.
Current close price: $${lastCandle?.close}
RSI: ${context.indicators.rsi[lastIdx]?.toFixed(2)}
MACD Histogram: ${context.indicators.macdHist[lastIdx]?.toFixed(4)}
ATR: ${context.indicators.atr[lastIdx]?.toFixed(4)}
EMA(20): ${context.indicators.ema20[lastIdx]?.toFixed(2)}
SMA(50): ${context.indicators.sma50[lastIdx]?.toFixed(2)}

Our quantitative system classified the regime as: ${quantitativeRegime}.
Synthesize a macro narrative and identify if there is an Accumulation, Distribution, Breakout, or sideways Trend.
`;
  }

  /**
   * Stub for future LLM regime analysis inference.
   */
  public static async invokeLLMRegime(
    context: StrategyContext,
    quantitativeRegime: string
  ): Promise<AIRegimeAnalysisResult> {
    const prompt = this.prepareRegimePrompt(context, quantitativeRegime);
    console.log("[AI-RegimeAnalysis] Stub invoked with prompt payload size:", prompt.length);

    return {
      regime: quantitativeRegime,
      narrative: `The asset ${context.symbol} is showing characteristics aligning with ${quantitativeRegime}. Volume and moving averages confirm the current structure.`,
      dominantIndicators: ["RSI", "MACD"],
      recommendedStrategyIds: [
        quantitativeRegime.includes("Trend") ? "ema-crossover" : "rsi-reversal",
      ],
    };
  }
}
