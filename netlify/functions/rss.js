exports.handler = async function () {
  const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQGCxkWIkygiPEkJE0in6ExMQkwVilR4e2N9zpKnCsAhVhvPLR-DbiGsbb3_ddNPYqw5DHXoOgA24ht/pub?gid=0&single=true&output=csv";
  const TIME_ZONE = "America/New_York";

  const response = await fetch(SHEET_URL, {
    headers: { "User-Agent": "Netlify RSS Feed" }
  });
  const text = await response.text();
  const rows = parseCsv(text);

  const nowET = getNowInTimeZone(TIME_ZONE);
  let currentItem = "No active period";

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const subject = (row[0] || "").trim();
    const startDate = (row[1] || "").trim();
    const startTime = (row[2] || "").trim();
    const endDate = (row[3] || "").trim();
    const endTime = (row[4] || "").trim();
    const allDay = (row[5] || "").trim().toLowerCase();
    const description = (row[6] || "").trim();

    if (!subject || !description) continue;
    if (!subject.toLowerCase().startsWith("period")) continue;
    if (allDay === "true") continue;
    if (!startDate || !startTime || !endDate || !endTime) continue;

    const start = buildLocalDateTime(startDate, startTime);
    const end = buildLocalDateTime(endDate, endTime);

    if (nowET >= start && nowET <= end) {
      currentItem = `${description}, ${subject}`;
      break;
    }
  }

  const nowUtc = new Date();
  const nowString = nowUtc.toUTCString();
  const feedUrl = "https://hsbellrss.netlify.app/.netlify/functions/rss";
  const guid = `hs-bell-${currentItem}-${nowUtc.getUTCFullYear()}-${nowUtc.getUTCMonth() + 1}-${nowUtc.getUTCDate()}-${nowUtc.getUTCHours()}-${nowUtc.getUTCMinutes()}`;

  const safeItem = escapeXml(currentItem);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Current Schedule</title>
    <link>${feedUrl}</link>
    <description>Live current bell schedule feed</description>
    <language>en-us</language>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <lastBuildDate>${nowString}</lastBuildDate>
    <ttl>1</ttl>
    <item>
      <title>${safeItem}</title>
      <description>${safeItem}</description>
      <summary>${safeItem}</summary>
      <link>${feedUrl}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${nowString}</pubDate>
      <author>Paramus Public Schools</author>
    </item>
  </channel>
</rss>`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    },
    body: xml
  };
};

function getNowInTimeZone(timeZone) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return new Date(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
}

function buildLocalDateTime(dateStr, timeStr) {
  const dateOnly = dateStr.split(" ")[0];
  const [year, month, day] = dateOnly.split("-").map(Number);
  const [hour, minute, second = "00"] = timeStr.split(":");

  return new Date(
    year,
    month - 1,
    day,
    Number(hour),
    Number(minute),
    Number(second)
  );
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}