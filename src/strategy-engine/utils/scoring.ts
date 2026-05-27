export class ScoringUtils {
  /**
   * Linearly scales a value between a min and max input bound to a target min/max scale.
   */
  public static linearScale(
    val: number,
    inMin: number,
    inMax: number,
    outMin: number = 0,
    outMax: number = 100
  ): number {
    if (inMax === inMin) return outMin;
    const clamped = Math.max(inMin, Math.min(inMax, val));
    const result = ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
    return Math.round(result);
  }
}
