export class MathUtils {
  /**
   * Calculates the arithmetic mean of an array of numbers.
   */
  public static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculates the standard deviation of an array of numbers.
   */
  public static stdDev(values: number[], meanVal?: number): number {
    if (values.length === 0) return 0;
    const m = meanVal !== undefined ? meanVal : this.mean(values);
    const sumDiffSq = values.reduce((sum, val) => {
      const diff = val - m;
      return sum + diff * diff;
    }, 0);
    return Math.sqrt(sumDiffSq / values.length);
  }

  /**
   * Calculates the slope of a line formed by the last N values.
   */
  public static slope(values: number[], period: number = 5): number {
    if (values.length < 2 || period < 2) return 0;
    const p = Math.min(period, values.length);
    const lastVal = values[values.length - 1];
    const prevVal = values[values.length - p];
    if (prevVal === 0) return 0;
    return (lastVal - prevVal) / prevVal;
  }
}
