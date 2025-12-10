import express from "express";
import axios from "axios";
import cheerio from "cheerio";
import cron from "cron";
import cors from "cors";
app.use(cors());

const app = express();
const PORT = process.env.PORT || 3000;

// Cache (data stored in memory)
let cache = {
  calendar: null,
  ranking: null,
  lastUpdate: null
};

// --- Scraping Function ---
async function scrapeRolskanet() {
  try {
    console.log("⏳ Fetching Rolskanet data...");

    const calendarURL = "https://rolskanet.fr/sportif/synthese/rencontres/RH";
    const rankingURL = "https://rolskanet.fr/sportif/synthese/classements/RH";

    const calendarHTML = (await axios.get(calendarURL)).data;
    const rankingHTML = (await axios.get(rankingURL)).data;

    const $cal = cheerio.load(calendarHTML);
    const $rank = cheerio.load(rankingHTML);

    // Extract **ALL MATCHES**
    const matches = [];
    $cal("table tbody tr").each((i, row) => {
      const cols = $cal(row).find("td").map((i, el) => $cal(el).text().trim()).get();
      matches.push({
        date: cols[0],
        home: cols[1],
        away: cols[2],
        score: cols[3]
      });
    });

    // Extract **RANKING**
    const ranking = [];
    $rank("table tbody tr").each((i, row) => {
      const cols = $rank(row).find("td").map((i, el) => $rank(el).text().trim()).get();
      ranking.push({
        pos: cols[0],
        team: cols[1],
        points: cols[2],
        played: cols[3]
      });
    });

    cache = {
      calendar: matches,
      ranking,
      lastUpdate: new Date().toISOString()
    };

    console.log("✅ Rolskanet data updated!");
  } catch (err) {
    console.error("❌ Scraping error:", err.message);
  }
}

// Run once at startup
await scrapeRolskanet();

// Update every 30 minutes
new cron.CronJob("*/30 * * * *", scrapeRolskanet).start();

// --- API ROUTES ---
app.get("/api/calendar", (req, res) => {
  res.json({
    updated: cache.lastUpdate,
    calendar: cache.calendar
  });
});

app.get("/api/ranking", (req, res) => {
  res.json({
    updated: cache.lastUpdate,
    ranking: cache.ranking
  });
});

// Start server
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
