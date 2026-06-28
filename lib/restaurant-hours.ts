export type DayHours = {
  open: string;
  close: string;
  is_closed?: boolean;
};

export type OpeningHours = Record<string, DayHours>;

const DAY_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const PROMPT_DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const PROMPT_DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

/** Human-readable weekly hours for Retell prompt (Monday–Sunday). */
export function formatOpeningHoursForPrompt(
  openingHours: OpeningHours | null | undefined,
): string {
  if (!openingHours || Object.keys(openingHours).length === 0) {
    return "Hours not configured.";
  }

  return PROMPT_DAY_ORDER.map((day) => {
    const hours = openingHours[day];
    const label = PROMPT_DAY_LABELS[day];
    if (!hours || hours.is_closed) return `${label}: Closed`;
    const [openH, openM] = hours.open.split(":").map(Number);
    const [closeH, closeM] = hours.close.split(":").map(Number);
    return `${label}: ${formatDisplayTime(openH, openM)} - ${formatDisplayTime(closeH, closeM)}`;
  }).join("\n");
}

export function formatRestaurantHoursBlock(
  openingHours: OpeningHours | null | undefined,
  options: { isOpen: boolean; lastOrderMinutesBeforeClose: number },
): string {
  return `${formatOpeningHoursForPrompt(openingHours)}

Manual status: ${options.isOpen ? "OPEN" : "CLOSED"} (owner toggle — if CLOSED, never take orders)
Last order cutoff: ${options.lastOrderMinutesBeforeClose} minutes before closing each day
Timezone: America/New_York (ET)`;
}

export function getETNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  }).formatToParts(now);

  const dayName = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() || "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

  return {
    now,
    dayName,
    currentMinutes: hour * 60 + minute,
    timeLabel: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
  };
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function dateAtETMinutes(base: Date, minutes: number): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);

  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  // ET wall time → UTC Date (handles EST/EDT via IANA zone)
  const guess = new Date(`${year}-${month}-${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  const utcParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(guess);

  const etH = parseInt(utcParts.find((p) => p.type === "hour")?.value || "0", 10);
  const etM = parseInt(utcParts.find((p) => p.type === "minute")?.value || "0", 10);
  const diffMin = (h * 60 + m) - (etH * 60 + etM);
  return new Date(guess.getTime() + diffMin * 60_000);
}

function dayIndex(name: string): number {
  const i = DAY_ORDER.indexOf(name);
  return i >= 0 ? i : 0;
}

function findNextTransition(
  openingHours: OpeningHours | null | undefined,
  fromDay: string,
  fromMinutes: number,
  currentlyWithinHours: boolean,
): { at: Date; to: "open" | "closed" } | null {
  if (!openingHours) return null;

  if (currentlyWithinHours) {
    const today = openingHours[fromDay];
    if (today && !today.is_closed) {
      const closeMinutes = parseTimeToMinutes(today.close);
      return {
        at: dateAtETMinutes(getETNow().now, closeMinutes),
        to: "closed",
      };
    }
  }

  for (let offset = 0; offset <= 7; offset++) {
    const dayIdx = (dayIndex(fromDay) + offset) % 7;
    const dayName = DAY_ORDER[dayIdx];
    const dayHours = openingHours[dayName];
    if (!dayHours || dayHours.is_closed) continue;

    const openMinutes = parseTimeToMinutes(dayHours.open);
    const closeMinutes = parseTimeToMinutes(dayHours.close);

    if (offset === 0) {
      if (fromMinutes < openMinutes) {
        return { at: dateAtETMinutes(getETNow().now, openMinutes), to: "open" };
      }
      if (fromMinutes >= closeMinutes) continue;
    } else {
      const base = new Date(getETNow().now.getTime() + offset * 86_400_000);
      return { at: dateAtETMinutes(base, openMinutes), to: "open" };
    }
  }

  return null;
}

export function formatDisplayTime(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

export function computeRestaurantHoursStatus(
  openingHours: OpeningHours | null | undefined,
  options?: { lastOrderMinutesBeforeClose?: number; isOpen?: boolean },
) {
  const { now, dayName, currentMinutes, timeLabel } = getETNow();
  const lastOrderBuffer = options?.lastOrderMinutesBeforeClose ?? 45;
  const manuallyClosed = options?.isOpen === false;
  const hours = openingHours?.[dayName];

  if (manuallyClosed) {
    return {
      day: dayName,
      current_time: timeLabel,
      within_hours: false,
      scheduled_open: false,
      accepting_orders: false,
      is_open: false,
      next_transition_at: null,
      next_transition_to: null,
      reason: "Restaurant is currently closed (manually closed by owner)",
      prep_time_minutes: 25,
    };
  }

  if (!hours || hours.is_closed) {
    const next = findNextTransition(openingHours, dayName, currentMinutes, false);
    return {
      day: dayName,
      current_time: timeLabel,
      within_hours: false,
      scheduled_open: false,
      accepting_orders: false,
      is_open: false,
      next_transition_at: next?.at.toISOString() ?? null,
      next_transition_to: next?.to ?? null,
      reason: "Restaurant is closed today",
      prep_time_minutes: 25,
    };
  }

  const openMinutes = parseTimeToMinutes(hours.open);
  let closeMinutes = parseTimeToMinutes(hours.close);

  // Handle overnight hours (e.g. open 10:30 AM, close 3:00 AM next day)
  const crossesMidnight = closeMinutes <= openMinutes;
  if (crossesMidnight) {
    closeMinutes += 24 * 60; // treat close time as next-day minutes
  }

  // If hours cross midnight, "current time" might also need a +24h adjustment
  // when checking against the open/close window if current time is in the
  // early-morning portion (e.g. 1:00 AM should count as "open" if close is 3:00 AM next day).
  let effectiveCurrentMinutes = currentMinutes;
  if (crossesMidnight && currentMinutes < openMinutes) {
    effectiveCurrentMinutes += 24 * 60;
  }

  const lastOrderMinutes = Math.max(openMinutes, closeMinutes - lastOrderBuffer);

  const within_hours = effectiveCurrentMinutes >= openMinutes && effectiveCurrentMinutes < closeMinutes;
  const accepting_orders =
    effectiveCurrentMinutes >= openMinutes && effectiveCurrentMinutes < lastOrderMinutes;

  const [openHour, openMin] = hours.open.split(":").map(Number);
  const [closeHour, closeMin] = hours.close.split(":").map(Number);

  const openTime = formatDisplayTime(openHour, openMin);
  const closeTime = formatDisplayTime(closeHour, closeMin);
  const lastOrderTime = formatDisplayTime(
    Math.floor(lastOrderMinutes / 60),
    lastOrderMinutes % 60,
  );

  const next = findNextTransition(openingHours, dayName, currentMinutes, within_hours);

  let reason: string | null = null;
  if (!accepting_orders) {
    reason =
      effectiveCurrentMinutes < openMinutes
        ? `We open at ${openTime}`
        : `Sorry, we stopped taking orders at ${lastOrderTime}. We close at ${closeTime}.`;
  }

  return {
    day: dayName,
    current_time: timeLabel,
    within_hours,
    scheduled_open: within_hours,
    accepting_orders,
    is_open: accepting_orders,
    open_time: openTime,
    close_time: closeTime,
    last_order_time: lastOrderTime,
    next_transition_at: next?.at.toISOString() ?? null,
    next_transition_to: next?.to ?? null,
    reason,
    ready_time: formatDisplayTime(
      Math.floor((currentMinutes + 25) / 60) % 24,
      (currentMinutes + 25) % 60,
    ),
  };
}
