/**
 * The business's own calendar date, not the server's local/UTC date -- every business in
 * this product is IST (Asia/Kolkata), which is UTC+5:30. Using the server's UTC date for a
 * "once per day" boundary is wrong for a 5.5-hour window every single day: from 12:00 AM to
 * 5:29 AM IST, the UTC calendar date hasn't rolled over yet, so it still reads as "yesterday"
 * -- confirmed as a real bug (independent audit), not a hypothetical edge case, since this
 * window recurs daily and any real usage near midnight/early morning IST hits it.
 *
 * No dependency on `Intl`'s locale data being anything specific -- `en-CA` is used purely
 * because it's the one built-in locale whose date formatting happens to already be
 * YYYY-MM-DD, not because the output is meant to look Canadian.
 */
export function getBusinessDateString(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}
