#!/bin/bash
MAX_JOBS=5
SCRIPT_DIR="$(pwd)"
LOG_DIR="$SCRIPT_DIR/logs/backtests"
mkdir -p "$LOG_DIR"

coins=("BTCUSDT" "ETHUSDT" "SOLUSDT")
days=(1 2 3 4 5)
modes=("SCALPING" "INTRADAY")

echo "Starting backtests with a concurrency limit of $MAX_JOBS..."

for coin in "${coins[@]}"; do
  for day in "${days[@]}"; do
    for mode in "${modes[@]}"; do
      # Wait if we have MAX_JOBS running
      while [ $(jobs -r -p | wc -l) -ge $MAX_JOBS ]; do
        sleep 1
      done
      
      echo "Queuing $coin for $day days on $mode"
      LOG_FILE="$LOG_DIR/${coin}_${day}d_${mode}.log"
      npm run replay -- --symbols "$coin" --days "$day" --mode "$mode" --debug > "$LOG_FILE" 2>&1 &
    done
  done
done

# Wait for all background jobs to finish
wait
echo "All 30 backtests completed successfully."
