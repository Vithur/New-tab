export function parseIcsDate(value = "", params = "") {
  const v = value.trim();
  const allDay = /^\d{8}$/.test(v);
  const utc = /[Zz]$/.test(v);
  const clean = v.replace(/[Zz]$/, "");
  let y, mo, d, h = 0, mi = 0, s = 0;
  if (allDay) {
    y = +clean.slice(0, 4); mo = +clean.slice(4, 6); d = +clean.slice(6, 8);
  } else {
    y = +clean.slice(0, 4); mo = +clean.slice(4, 6); d = +clean.slice(6, 8);
    h = +clean.slice(9, 11) || 0; mi = +clean.slice(11, 13) || 0; s = +clean.slice(13, 15) || 0;
  }
  let date;
  if (utc) {
    date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  } else {
    date = new Date(y, mo - 1, d, h, mi, s);
  }
  return { date, allDay };
}

const unescapeText = (s = "") =>
  s.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

export function parseICS(text) {
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const lines = unfolded.split("\n");
  const events = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/);
    if (!m) continue;
    const key = m[1].toUpperCase();
    const params = m[2] || "";
    const value = m[3];
    if (key === "BEGIN" && value.trim() === "VEVENT") {
      cur = {};
    } else if (key === "END" && value.trim() === "VEVENT") {
      if (cur && cur.start) events.push(cur);
      cur = null;
    } else if (cur) {
      if (key === "DTSTART") cur.start = parseIcsDate(value, params);
      else if (key === "DTEND") cur.end = parseIcsDate(value, params);
      else if (key === "SUMMARY") cur.summary = unescapeText(value);
      else if (key === "UID") cur.uid = value;
    }
  }
  return events;
}

export function upcomingEvents(events, maxEvents = 8) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return events
    .filter((ev) => {
      const end = ev.end?.date || ev.start?.date;
      return end ? end >= todayStart : true;
    })
    .sort((a, b) => (a.start?.date || 0) - (b.start?.date || 0))
    .slice(0, maxEvents);
}

export async function fetchCalendar(url) {
  const res = await fetch(url.trim(), { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return parseICS(text);
}

export const calendarOrigin = (url) => {
  try {
    return new URL(url.trim()).origin + "/";
  } catch {
    return null;
  }
};
