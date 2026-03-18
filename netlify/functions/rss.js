exports.handler = async function () {
  const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQGCxkWIkygiPEkJE0in6ExMQkwVilR4e2N9zpKnCsAhVhvPLR-DbiGsbb3_ddNPYqw5DHXoOgA24ht/pub?gid=0&single=true&output=csv";

  const response = await fetch(SHEET_URL);
  const text = await response.text();

  const rows = text.split("\n").map(r => r.split(","));

  const now = new Date();
  let currentItem = "No active period";

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    const subject = row[0];
    const startDate = row[1];
    const startTime = row[2];
    const endDate = row[3];
    const endTime = row[4];
    const description = row[6];

    if (!subject || !description) continue;
    if (!subject.toLowerCase().includes("period")) continue;

    const start = new Date(`${startDate.split(" ")[0]}T${startTime}`);
    const end = new Date(`${endDate.split(" ")[0]}T${endTime}`);

    if (now >= start && now <= end) {
      currentItem = `${description}, ${subject}`;
      break;
    }
  }

  const nowString = new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Current Schedule</title>
    <link>${SHEET_URL}</link>
    <description>Live schedule</description>
    <lastBuildDate>${nowString}</lastBuildDate>
    <item>
      <title>${currentItem}</title>
      <guid isPermaLink="false">${Date.now()}</guid>
      <pubDate>${nowString}</pubDate>
    </item>
  </channel>
</rss>`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8"
    },
    body: xml
  };
};