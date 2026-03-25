exports.handler = async function () {
  const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQGCxkWIkygiPEkJE0in6ExMQkwVilR4e2N9zpKnCsAhVhvPLR-DbiGsbb3_ddNPYqw5DHXoOgA24ht/pub?gid=0&single=true&output=csv";
  const TIME_ZONE = "America/New_York";

  const response = await fetch(SHEET_URL, {
    headers: { "User-Agent": "Netlify Bell Display" }
  });

  if (!response.ok) {
    return htmlResponse("Feed source error");
  }

  const text = await response.text();
  const rows = parseCsv(text);

  const nowET = getNowInTimeZone(TIME_ZONE);

  let currentItem = "No active period";
  let nextPeriodTime = null;
  let currentPeriodNumber = null;
  let inPassingTime = false;

  const periodsToday = [];

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

    periodsToday.push({
      subject,
      description,
      start,
      end
    });
  }

  periodsToday.sort((a, b) => a.start - b.start);

  for (let i = 0; i < periodsToday.length; i++) {
    const p = periodsToday[i];
    const periodMatch = p.subject.match(/\d+/);
    const periodNum = periodMatch ? periodMatch[0] : null;

    if (nowET >= p.start && nowET <= p.end) {
      currentItem = `${p.description}, ${p.subject}`;
      nextPeriodTime = p.end;
      currentPeriodNumber = periodNum;
      break;
    }

    if (i < periodsToday.length - 1) {
      const nextP = periodsToday[i + 1];
      if (nowET > p.end && nowET < nextP.start) {
        inPassingTime = true;
        currentItem = `${p.description}, Passing Time`;
        nextPeriodTime = nextP.start;
        currentPeriodNumber = periodNum;
        break;
      }
    }

    if (nowET < p.start && !nextPeriodTime) {
      currentItem = `${p.description}, Before ${p.subject}`;
      nextPeriodTime = p.start;
      currentPeriodNumber = periodNum;
      break;
    }
  }

  const nextTimeParts = nextPeriodTime
    ? {
        year: nextPeriodTime.getFullYear(),
        month: nextPeriodTime.getMonth(),
        day: nextPeriodTime.getDate(),
        hour: nextPeriodTime.getHours(),
        minute: nextPeriodTime.getMinutes(),
        second: nextPeriodTime.getSeconds()
      }
    : null;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="300">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body {
    margin: 0;
    background: transparent;
    overflow: hidden;
  }

  .overlay {
    position: absolute;
    bottom: 0;
    width: 100%;
    font-family: Arial, sans-serif;
    color: white;
    padding: 2px 12px;
    font-size: 1.1vw;
    font-weight: bold;
    white-space: nowrap;
    box-sizing: border-box;
    line-height: 1.2;
  }
</style>
</head>
<body>

<div class="overlay" id="bar"></div>

<script>
const currentItem = "${escapeJs(currentItem)}";
const nextTimeParts = ${JSON.stringify(nextTimeParts)};
const currentPeriodNumber = "${escapeJs(currentPeriodNumber || "")}";
const inPassingTime = ${inPassingTime};

function formatCountdown(ms) {
  if (ms <= 0) return "Now";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + "m " + String(seconds).padStart(2, "0") + "s";
}

function getBarColor(period, passing) {
  if (passing) return "rgba(90,90,90,0.9)";

  const colors = {
    "1": "rgba(183,28,28,0.9)",
    "2": "rgba(13,71,161,0.9)",
    "3": "rgba(46,125,50,0.9)",
    "4": "rgba(109,76,65,0.9)",
    "5": "rgba(123,31,162,0.9)",
    "6": "rgba(0,121,107,0.9)",
    "7": "rgba(230,81,0,0.9)",
    "8": "rgba(40,53,147,0.9)"
  };

  return colors[period] || "rgba(0,0,0,0.8)";
}

function buildNextTime() {
  if (!nextTimeParts) return null;
  return new Date(
    nextTimeParts.year,
    nextTimeParts.month,
    nextTimeParts.day,
    nextTimeParts.hour,
    nextTimeParts.minute,
    nextTimeParts.second
  );
}

function updateBar() {
  const now = new Date();

  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  });

  let countdownText = "";
  const nextTime = buildNextTime();

  if (nextTime) {
    const diff = nextTime - now;
    countdownText = " | Next in " + formatCountdown(diff);
  }

  const bar = document.getElementById("bar");
  bar.style.background = getBarColor(currentPeriodNumber, inPassingTime);
  bar.textContent = date + " | " + time + " | " + currentItem + countdownText;
}

updateBar();
setInterval(updateBar, 1000);
</script>

</body>
</html>`;

  return htmlResponse(html, true);
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

function escapeJs(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, "")
    .replace(/\r/g, "");
}

function htmlResponse(body, isHtml = false) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": isHtml ? "text/html; charset=utf-8" : "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate"
    },
    body
  };
}
