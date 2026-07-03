// Time (local) — degoog bang-command plugin
//
// Shows the current time in a city or timezone. Fully offline: it uses the
// JavaScript runtime's built-in IANA timezone database (Intl), so no external
// service is contacted and no query ever leaves your network.
//
// Improvement over the original hardcoded plugin: instead of a small fixed
// city map, this matches against the *complete* IANA timezone list
// (~350 zones) via Intl.supportedValuesOf('timeZone'). That means cities like
// Rome, Madrid, Cairo, Reykjavik, Auckland etc. resolve automatically.
// A small alias map on top adds local-language names (German) and shortcuts.

// Hand-maintained aliases: local-language names and common shortcuts that
// don't appear as the last path segment of an IANA zone.
const TZ_ALIASES = {
  japan: "Asia/Tokyo",
  uk: "Europe/London",
  nyc: "America/New_York",
  la: "America/Los_Angeles",
  india: "Asia/Kolkata",
  mumbai: "Asia/Kolkata",
  beijing: "Asia/Shanghai",
  schweiz: "Europe/Zurich",
  bern: "Europe/Zurich",
  griechenland: "Europe/Athens",
  athen: "Europe/Athens",
  wien: "Europe/Vienna",
  rom: "Europe/Rome",
  mailand: "Europe/Rome",
  moskau: "Europe/Moscow",
  koeln: "Europe/Berlin",
  muenchen: "Europe/Berlin",
  deutschland: "Europe/Berlin",
  utc: "UTC",
  gmt: "UTC",
};

// Build a lookup from the runtime's full IANA list once, mapping the final
// path segment (the city) to the full zone name, e.g. "rome" -> "Europe/Rome".
let _cityIndex = null;
const _buildCityIndex = () => {
  const index = {};
  let zones = [];
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      zones = Intl.supportedValuesOf("timeZone");
    }
  } catch {
    zones = [];
  }
  for (const zone of zones) {
    const parts = zone.split("/");
    const city = parts[parts.length - 1].replace(/_/g, " ").toLowerCase();
    // First match wins; skip if a city name is ambiguous across regions.
    if (!(city in index)) index[city] = zone;
  }
  return index;
};

const _esc = (s) => {
  if (typeof s !== "string") return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const _isValidZone = (zone) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const _resolveTimeZone = (input) => {
  const key = input.trim().toLowerCase().replace(/\s+/g, " ");

  // 1) hand-maintained aliases (German names, shortcuts)
  if (TZ_ALIASES[key]) return TZ_ALIASES[key];

  // 2) full IANA city index (Rome, Madrid, Cairo, ...)
  if (!_cityIndex) _cityIndex = _buildCityIndex();
  if (_cityIndex[key]) return _cityIndex[key];

  // 3) direct IANA name, e.g. "America/New_York" or "Europe/Rome"
  const normalized = input.trim().replace(/\s+/g, "_");
  if (_isValidZone(normalized)) return normalized;

  return null;
};

export default {
  isClientExposed: false,
  name: "Time",
  description: "Show current time in a timezone or city. Fully offline.",
  trigger: "time",
  aliases: ["tz", "clock"],
  naturalLanguagePhrases: [
    "what time is it in",
    "time in",
    "current time in",
    "what's the time in",
  ],
  settingsSchema: [],

  execute(args) {
    const place = args.trim().replace(/[?.,!]+$/, "").trim();
    if (!place) {
      return {
        title: "Time",
        html:
          `<div class="command-result"><p>Usage: <code>!time &lt;city or timezone&gt;</code></p>` +
          `<p>Examples: <code>!time Tokyo</code>, <code>!time Rome</code>, <code>!time America/New_York</code></p></div>`,
      };
    }

    const tz = _resolveTimeZone(place);
    if (!tz) {
      return {
        title: "Time",
        html: `<div class="command-result"><p>Unknown timezone or city: <strong>${_esc(place)}</strong></p></div>`,
      };
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const dateStr = now.toLocaleDateString("en-GB", {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const label = tz.replace(/_/g, " ");
    const html =
      `<div class="command-result time-result">` +
      `<h3 class="time-place">${_esc(label)}</h3>` +
      `<p class="time-time">${_esc(timeStr)}</p>` +
      `<p class="time-date">${_esc(dateStr)}</p></div>`;
    return { title: `Time: ${label}`, html };
  },
};
