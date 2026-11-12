/** The browser's IANA time zone (falls back to UTC). */
export const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
