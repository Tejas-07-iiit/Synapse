import os

mapping = {
    "zeiierman-volatility": ("INTRADAY", ["15m", "30m", "1h"]),
    "wavetrend": ("SCALPING", ["1m", "3m", "5m"]),
    "volatility-regime": ("INTRADAY", ["15m", "30m", "1h"]),
    "time-series-momentum": ("INTRADAY", ["15m", "30m", "1h"]),
    "t3-nexus": ("INTRADAY", ["15m", "30m", "1h"]),
    "sr-sweep": ("SCALPING", ["1m", "3m", "5m"]),
    "squeeze-momentum": ("INTRADAY", ["15m", "30m", "1h"]),
    "short-term-reversal": ("SCALPING", ["1m", "3m", "5m"]),
    "sma-trend-filter": ("INTRADAY", ["15m", "30m", "1h"]),
    "rsi-reversal": ("SCALPING", ["1m", "3m", "5m"]),
    "residual-momentum": ("SCALPING", ["1m", "3m", "5m"]),
    "range-breakout-high": ("SCALPING", ["1m", "3m", "5m"]),
    "rally-base-drop": ("SCALPING", ["1m", "3m", "5m"]),
    "parabolic-rsi": ("SCALPING", ["1m", "3m", "5m"]),
    "news-fear-greed": ("INTRADAY", ["15m", "30m", "1h"]),
    "momentum": ("SCALPING", ["1m", "3m", "5m"]),
    "mean-reversion": ("SCALPING", ["1m", "3m", "5m"]),
    "macd-momentum": ("SCALPING", ["1m", "3m", "5m"]),
    "ma-crossover-var": ("INTRADAY", ["15m", "30m", "1h"]),
    "lorentzian": ("INTRADAY", ["15m", "30m", "1h"]),
    "ichimoku-cloud": ("INTRADAY", ["15m", "30m", "1h"]),
    "hyper-supertrend": ("INTRADAY", ["15m", "30m", "1h"]),
    "heiken-ashi-swing": ("INTRADAY", ["15m", "30m", "1h"]),
    "hash-ribbons": ("INTRADAY", ["15m", "30m", "1h"]),
    "grid": ("SCALPING", ["1m", "3m", "5m"]),
    "golden-cross": ("INTRADAY", ["15m", "30m", "1h"]),
    "ema-crossover": ("SCALPING", ["1m", "3m", "5m"]),
    "ema-cross-adx": ("INTRADAY", ["15m", "30m", "1h"]),
    "dow-mfi-rsi": ("INTRADAY", ["15m", "30m", "1h"]),
    "donchian-breakout": ("SCALPING", ["1m", "3m", "5m"]),
    "defensive": ("INTRADAY", ["15m", "30m", "1h"]),
    "bollinger-reversion": ("SCALPING", ["1m", "3m", "5m"]),
    "bollinger-breakout": ("SCALPING", ["1m", "3m", "5m"]),
}

base_path = "src/strategy-engine/strategies"

for strategy_id, (category, timeframes) in mapping.items():
    file_path = os.path.join(base_path, strategy_id, "index.ts")
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
    
    with open(file_path, "r") as f:
        content = f.read()
    
    import re
    
    # Update category
    content = re.sub(r'public category: TradingMode = TradingMode\.(SCALPING|INTRADAY);', 
                     f'public category: TradingMode = TradingMode.{category};', content)
    
    # Update timeframes
    timeframes_str = str(timeframes).replace("'", '"')
    content = re.sub(r'public timeframes = \[.*?\];', 
                     f'public timeframes = {timeframes_str};', content, flags=re.DOTALL)
    
    # Also update single timeframe if it exists to match first timeframe in list
    content = re.sub(r'public timeframe = ".*?";', 
                     f'public timeframe = "{timeframes[0]}";', content)

    with open(file_path, "w") as f:
        f.write(content)
    print(f"Updated {strategy_id}")
