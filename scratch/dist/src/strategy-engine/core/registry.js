class StrategyRegistry {
    strategies = new Map();
    lastSignals = [];
    registerStrategy(strategy) {
        if (this.strategies.has(strategy.id)) {
            console.warn(`Strategy with ID "${strategy.id}" is already registered. Overwriting.`);
        }
        this.strategies.set(strategy.id, strategy);
        console.log(`[Registry] Registered strategy: ${strategy.name} [ID: ${strategy.id}]`);
        // Sync strategy to database (non-blocking server-side check)
        if (typeof window === "undefined") {
            import("@/lib/prisma").then(({ default: prisma }) => {
                prisma.strategy.upsert({
                    where: { id: strategy.id },
                    update: { name: strategy.name, description: strategy.description },
                    create: { id: strategy.id, name: strategy.name, description: strategy.description, enabled: strategy.enabled },
                }).catch(() => { });
            });
        }
    }
    unregisterStrategy(id) {
        if (this.strategies.has(id)) {
            const strategy = this.strategies.get(id);
            this.strategies.delete(id);
            console.log(`[Registry] Unregistered strategy: ${strategy?.name} [ID: ${id}]`);
        }
    }
    enableStrategy(id) {
        const strategy = this.strategies.get(id);
        if (strategy) {
            strategy.enabled = true;
            console.log(`[Registry] Enabled strategy: ${strategy.name}`);
            if (typeof window === "undefined") {
                import("@/lib/prisma").then(({ default: prisma }) => {
                    prisma.strategy.update({
                        where: { id },
                        data: { enabled: true },
                    }).catch(() => { });
                });
            }
        }
    }
    disableStrategy(id) {
        const strategy = this.strategies.get(id);
        if (strategy) {
            strategy.enabled = false;
            console.log(`[Registry] Disabled strategy: ${strategy.name}`);
            if (typeof window === "undefined") {
                import("@/lib/prisma").then(({ default: prisma }) => {
                    prisma.strategy.update({
                        where: { id },
                        data: { enabled: false },
                    }).catch(() => { });
                });
            }
        }
    }
    getStrategies() {
        return Array.from(this.strategies.values());
    }
    getStrategy(id) {
        return this.strategies.get(id);
    }
    runStrategies(context) {
        const signals = [];
        for (const strategy of this.strategies.values()) {
            const activeSymbols = strategy.symbols || [];
            const activeTimeframes = strategy.timeframes || [];
            if ((activeSymbols.includes(context.symbol) || activeSymbols.length === 0) &&
                (activeTimeframes.includes(context.timeframe) || activeTimeframes.length === 0)) {
                try {
                    const sig = strategy.evaluate(context);
                    signals.push(sig);
                }
                catch (error) {
                    console.error(`[Registry] Error evaluating strategy ${strategy.id}:`, error);
                }
            }
        }
        this.lastSignals = signals;
        return signals;
    }
    runStrategiesForSymbol(symbol, context) {
        const signals = [];
        for (const strategy of this.strategies.values()) {
            const activeSymbols = strategy.symbols || [];
            const activeTimeframes = strategy.timeframes || [];
            if ((activeSymbols.includes(symbol) || activeSymbols.length === 0) &&
                (activeTimeframes.includes(context.timeframe) || activeTimeframes.length === 0)) {
                try {
                    const sig = strategy.evaluate(context);
                    signals.push(sig);
                }
                catch (error) {
                    console.error(`[Registry] Error evaluating strategy ${strategy.id} for symbol ${symbol}:`, error);
                }
            }
        }
        return signals;
    }
    runStrategiesForTimeframe(timeframe, context) {
        const signals = [];
        for (const strategy of this.strategies.values()) {
            const activeSymbols = strategy.symbols || [];
            const activeTimeframes = strategy.timeframes || [];
            if ((activeSymbols.includes(context.symbol) || activeSymbols.length === 0) &&
                (activeTimeframes.includes(timeframe) || activeTimeframes.length === 0)) {
                try {
                    const sig = strategy.evaluate(context);
                    signals.push(sig);
                }
                catch (error) {
                    console.error(`[Registry] Error evaluating strategy ${strategy.id} for timeframe ${timeframe}:`, error);
                }
            }
        }
        return signals;
    }
    getActiveSignals() {
        return this.lastSignals;
    }
    clear() {
        this.strategies.clear();
        this.lastSignals = [];
    }
}
export const strategyRegistry = new StrategyRegistry();
// Export the expected methods directly as functions for ease of import
export const registerStrategy = (strategy) => strategyRegistry.registerStrategy(strategy);
export const unregisterStrategy = (id) => strategyRegistry.unregisterStrategy(id);
export const enableStrategy = (id) => strategyRegistry.enableStrategy(id);
export const disableStrategy = (id) => strategyRegistry.disableStrategy(id);
export const runStrategies = (context) => strategyRegistry.runStrategies(context);
export const runStrategiesForSymbol = (symbol, context) => strategyRegistry.runStrategiesForSymbol(symbol, context);
export const runStrategiesForTimeframe = (timeframe, context) => strategyRegistry.runStrategiesForTimeframe(timeframe, context);
export const getActiveSignals = () => strategyRegistry.getActiveSignals();
