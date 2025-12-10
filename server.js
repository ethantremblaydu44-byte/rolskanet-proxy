import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();

app.use(cors({
    origin: "*",
    methods: "GET",
    allowedHeaders: "*"
}));

app.use(express.json());

// Fonction pour faire un fetch avec une "fausse" identité de navigateur
async function fetchHtml(url) {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
    });
    return await response.text();
}

// ------------ SCRAPER FUNCTIONS ----------------

async function scrapeCalendar() {
    console.log("🔍 Scraping Calendar..."); // Log pour debug
    const url = "https://rolskanet.fr/sportif/synthese/rencontres/RH";
    
    try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        const matches = [];

        $(".table tbody tr").each((i, el) => {
            const tds = $(el).find("td");
            // Vérification que la ligne contient bien des données
            if (tds.length > 0) {
                const date = $(tds[0]).text().trim();
                const teams = $(tds[1]).text().trim();
                const score = $(tds[2]).text().trim();
                matches.push({ date, teams, score });
            }
        });

        console.log(`✅ Calendar found: ${matches.length} matches`);
        return matches;
    } catch (error) {
        console.error("❌ Error scraping calendar:", error);
        return []; // Retourne un tableau vide en cas d'erreur pour éviter le crash
    }
}

async function scrapeRanking() {
    const url = "https://rolskanet.fr/sportif/synthese/classements/RH";
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    const ranking = [];

    $(".table tbody tr").each((i, el) => {
        const tds = $(el).find("td");
        if (tds.length > 0) {
            const position = $(tds[0]).text().trim();
            const team = $(tds[1]).text().trim();
            const points = $(tds[2]).text().trim();
            ranking.push({ position, team, points });
        }
    });

    return ranking;
}

async function findNextMatch() {
    const calendar = await scrapeCalendar();
    
    // Sécurité : si calendar est vide ou undefined, on renvoie null
    if (!calendar || calendar.length === 0) return null;

    // find the first game where score is empty OR indicates a future match
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
