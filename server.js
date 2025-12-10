import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();

// ---- ENABLE CORS FOR EVERYTHING ----
app.use(cors({
    origin: "*",
    methods: "GET",
    allowedHeaders: "*"
}));

app.use(express.json());

// ------------ SCRAPER FUNCTIONS ----------------

async function scrapeCalendar() {
    const url = "https://rolskanet.fr/sportif/synthese/rencontres/RH";
    const html = await fetch(url).then(res => res.text());
    const $ = cheerio.load(html);

    const matches = [];

    $(".table tbody tr").each((i, el) => {
        const tds = $(el).find("td");
        const date = $(tds[0]).text().trim();
        const teams = $(tds[1]).text().trim();
        const score = $(tds[2]).text().trim();

        matches.push({ date, teams, score });
    });

    return matches;
}

async function scrapeRanking() {
    const url = "https://rolskanet.fr/sportif/synthese/classements/RH";
    const html = await fetch(url).then(res => res.text());
    const $ = cheerio.load(html);

    const ranking = [];

    $(".table tbody tr").each((i, el) => {
        const tds = $(el).find("td");
        const position = $(tds[0]).text().trim();
        const team = $(tds[1]).text().trim();
        const points = $(tds[2]).text().trim();

        ranking.push({ position, team, points });
    });

    return ranking;
}

async function findNextMatch() {
    const calendar = await scrapeCalendar();

    // find the first game where score is empty
    return calendar.find(m => m.score === "" || m.score === "-") || null;
}

// ---------------- API ENDPOINTS ------------------

app.get("/api/calendar", async (req, res) => {
    try {
        const data = await scrapeCalendar();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Calendar scraping failed" });
    }
});

app.get("/api/ranking", async (req, res) => {
    try {
        const data = await scrapeRanking();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Ranking scraping failed" });
    }
});

app.get("/api/next-match", async (req, res) => {
    try {
        const data = await findNextMatch();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Next match scraping failed" });
    }
});

// ---------------- SERVER --------------------------

app.get("/", (req, res) => {
    res.send("Rolskanet scraper running 🚀");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log("Server running on port " + port);
});
