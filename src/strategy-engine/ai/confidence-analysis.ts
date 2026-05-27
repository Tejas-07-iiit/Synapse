import { StrategySignal, StrategyContext } from "../types";

export interface AIConfidenceAnalysisResult {
  confidenceAdjustment: number; // e.g. -5, 0, +10
  aiReasoning: string[];
}

export class AIConfidenceAnalysisPreparer {
  /**
   * Prepares the prompt requesting a sanity check on quantitative confidence score.
   */
  public static prepareAnalysisPrompt(signal: StrategySignal, context: StrategyContext): string {
    return `
Review signal: ${signal.signal} for ${signal.symbol} with base confidence ${signal.confidence}%.
Context:
RSI: ${context.indicators.rsi[context.candles.length - 1]?.toFixed(2)}
MACD Hist: ${context.indicators.macdHist[context.candles.length - 1]?.toFixed(4)}
Check if there is a divergence or liquidity sweep that should decrease or increase our confidence score.
`;
  }

  /**
   * Stub for AI confidence analysis.
   */
  public static async invokeLLMConfidence(
    signal: StrategySignal,
    context: StrategyContext
  ): Promise<AIConfidenceAnalysisResult> {
    const prompt = this.prepareAnalysisPrompt(signal, context);
    console.log("[AI-ConfidenceAnalysis] Stub invoked with prompt payload size:", prompt.length);

    return {
      confidenceAdjustment: 0,
      aiReasoning: ["Quantitative engine indicators alignment is optimal.", "No bearish/bullish divergences detected in higher timeframes."],
    };
  }
}
