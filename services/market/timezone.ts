/**
 * Timezone Normalization Engine
 * Manages DST-aware conversions between UTC and User Local Timezones
 * without altering the underlying raw data in the data store.
 */
class TimezoneEngine {
  /**
   * Detects the browser's timezone (e.g., "Asia/Kolkata").
   */
  public getBrowserTimezone(): string {
    if (typeof window === "undefined") return "UTC";
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }

  /**
   * Returns the timezone offset in milliseconds for a specific UTC timestamp.
   * Accounts for DST changes dynamically at that specific date.
   */
  public getOffsetMs(utcTimeMs: number): number {
    if (typeof window === "undefined") return 0;
    return new Date(utcTimeMs).getTimezoneOffset() * 60 * 1000;
  }

  /**
   * Converts a UTC timestamp (in ms) to the local timezone timestamp (in ms).
   */
  public utcToLocal(utcTimeMs: number): number {
    return utcTimeMs - this.getOffsetMs(utcTimeMs);
  }

  /**
   * Converts a local timezone timestamp (in ms) back to the UTC timestamp (in ms).
   */
  public localToUtc(localTimeMs: number): number {
    if (typeof window === "undefined") return localTimeMs;
    const offsetMs = new Date(localTimeMs).getTimezoneOffset() * 60 * 1000;
    return localTimeMs + offsetMs;
  }

  /**
   * Formats a UTC timestamp into local timezone time string (HH:MM:SS).
   */
  public formatLocalTime(utcTimeMs: number): string {
    return new Date(utcTimeMs).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }
}

export const timezoneEngine = new TimezoneEngine();
export default timezoneEngine;
