exports.handler = async function () {
  const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQGCxkWIkygiPEkJE0in6ExMQkwVilR4e2N9zpKnCsAhVhvPLR-DbiGsbb3_ddNPYqw5DHXoOgA24ht/pub?gid=0&single=true&output=csv";
  const TIME_ZONE = "America/New_York";

  const response = await fetch(SHEET_URL);
  const text = await response.text();
  const rows = text.split("\n").map(r => r.split(","));

  const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: TIME_ZONE }));

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
    if (!subject.toLowerCase().startsWith("period")) continue;

    const start = new Date(`${startDate.split(" ")[0]}T${startTime}`);
    const end = new Date(`${endDate.split(" ")[0]}T${endTime}`);

    if (nowET >= start && nowET <= end) {
      currentItem = `${description}, ${subject}`;
      break;
    }
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="60">
<style>
  body {
    margin: 0;
    background: transparent;
    overflow: hidden;
  }

  .overlay {
    position: absolute;
    top: 0;
    width: 100%;
    text-align: center;
    font-size: 4vw;
    font-weight: bold;
    font-family: Arial, sans-serif;
    color: white;
    background: rgba(0,0,0,0.6);
    padding: 10px 0;
  }
</style>
</head>
<body>

<div class="overlay">
  ${currentItem}
</div>

</body>
</html>`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html"
    },
    body: html
  };
};