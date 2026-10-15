/**
 * Dates on the platform: DD/MM/YYYY, shown in India Standard Time.
 * The API stores and returns UTC; conversion happens only here, at the edge.
 * IST is a fixed UTC+05:30 (no daylight saving), so a fixed offset is exact.
 */
export const TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "16/10/2026" */
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));

/** "17:00 IST" */
export const formatTime = (iso: string) => `${timeFmt.format(new Date(iso))} IST`;

/** "16/10/2026, 17:00 IST" */
export const formatDateTime = (iso: string) =>
  `${dateFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))} IST`;

/** ISO (UTC) → value for <input type="datetime-local"> in IST: "2026-10-16T17:00". */
export function toIstInputValue(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * <input type="datetime-local"> value, read as IST → ISO string with offset.
 * "2026-10-16T17:00" → "2026-10-16T17:00:00+05:30", whatever the browser's own timezone is.
 */
export const fromIstInputValue = (value: string) => `${value}:00${IST_OFFSET}`;

// ---------------------------------------------------------------- scores
// The API sends scores as integers (half-points, quarter-points) so its maths and
// tie checks are exact; fractions only appear here, for display.

const FRACTION = ["", "¼", "½", "¾"] as const;

function fromQuarters(quarters: number): string {
  const whole = Math.floor(quarters / 4);
  const rest = FRACTION[quarters % 4];
  return whole === 0 && rest ? rest : `${whole}${rest}`;
}

/** Half-points → chess points: 5 → "2½", 1 → "½", 0 → "0". */
export const formatPoints = (halfPoints: number) => fromQuarters(halfPoints * 2);

/** Sonneborn-Berger quarter-points → "1¾". */
export const formatSb = (quarters: number) => fromQuarters(quarters);
