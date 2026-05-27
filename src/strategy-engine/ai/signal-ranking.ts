import { StrategySignal } from "../types";

export interface AISignalRankInput {
  signals: StrategySignal[];
  marketContext: {
    regime: string;
    volatility: string;
    sentimentScore: number;
  };
}

export interface AISignalRankResult {
  rankedSignalIds: string[];
  explanation: string;
  recommendedAllocationPercents: Record<string, number>;
}

export class AISignalRankingPreparer {
  /**
   * Prepares a structured payload/prompt context for sending to an LLM for ranking.
   */
  public static preparePromptPayload(input: AISignalRankInput): string {
    return JSON.stringify(
      {
        task: "Rank the following trading signals based on market context and prioritize high-probability setups.",
        marketContext: input.marketContext,
        signals: input.signals.map((sig) => ({
          id: `${sig.strategyId}_${sig.symbol}`,
          symbol: sig.symbol,
          timeframe: sig.timeframe,
          direction: sig.signal,
          confidence: sig.confidence,
          entry: sig.entry,
          stopLoss: sig.stopLoss,
          takeProfit: sig.takeProfit,
          reasoning: sig.reasoning,
        })),
      },
      null,
      2
    );
  }

  /**
   * Stub for future LLM api invocation (e.g. Groq).
   */
  public static async invokeLLMRanking(input: AISignalRankInput): Promise<AISignalRankResult> {
    const prompt = this.preparePromptPayload(input);
    console.log("[AI-SignalRanking] Stub invoked with prompt payload size:", prompt.length);
    
    // Default fallback: Rank by confidence
    const sorted = [...input.signals].sort((a, b) => b.confidence - a.confidence);
    const rankedSignalIds = sorted.map((s) => `${s.strategyId}_${s.symbol}`);

    const recommendedAllocationPercents: Record<string, number> = {};
    if (rankedSignalIds.length > 0) {
      recommendedAllocationPercents[rankedSignalIds[0]] = 50; // 50% allocation to top pick
      if (rankedSignalIds[1]) {
        recommendedAllocationPercents[rankedSignalIds[1]] = 30; // 30% allocation to second pick
      }
    }

    return {
      rankedSignalIds,
      explanation: "Fallback sorting by quantitative confidence engine. Real LLM inference will replace this explanation with deep qualitative market insights.",
      recommendedAllocationPercents,
    };
  }
}
