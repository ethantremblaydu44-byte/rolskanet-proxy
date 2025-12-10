import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Fonction utilitaire pour simuler un vrai navigateur
async function fetchHtml(url) {
    console.log(`📡 Fetching: ${url}`);
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
        }
    });
    const text = await response.text();
    console.log(`📦 Received ${text.length} characters`);
    return text;
}

// ------------ SCRAPER FUNCTIONS ----------------

async function scrapeCalendar() {
    const url = "https://rolskanet.fr/sportif/synthese/rencontres/RH";
    try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        const matches = [];

        // STRATÉGIE "LARGE" : On prend toutes les lignes de tous les tableaux
        const rows = $("tr"); 
        console.log(`🔍 Found ${rows.length} rows (tr) in HTML`);

        rows.each((i, el) => {
            const tds = $(el).find("td");
            
            // On cherche une ligne qui a au moins 3 colonnes (Date, Equipes, Score)
            if (tds.length >= 3) {
                const col1 = $(tds[0]).text().trim(); // Date ?
                const col2 = $(tds[1]).text().trim(); // Equipes ?
                const col3 = $(tds[2]).text().trim(); // Score ?

                // Petit filtre pour éviter les en-têtes bizarres
                // On garde si la colonne 1 ressemble à une date (contient un chiffre)
                if (col1.match(/\d/) && col2.length > 3) {
                    matches.push({ 
                        date: col1, 
                        teams: col2, 
                        score: col3 
                    });
                }
            }
        });

        console.log(`✅ Extracted ${matches.length} matches`);
        return matches;
    } catch (error) {
        console.error("❌ Error scraping calendar:", error);
        return [];
    }
}

async function scrapeRanking() {
    const url = "https://rolskanet.fr/sportif/synthese/classements/RH";
    try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        const ranking = [];

        // STRATÉGIE "LARGE"
        const rows = $("tr");
        
        rows.each((i, el) => {
            const tds = $(el).find("td");
            
            // Un classement a souvent : Pos, Equipe, Pts, Joués, Diff (donc au moins 3 ou 4 colonnes)
            if (tds.length >= 3) {
                const pos = $(tds[0]).text().trim();
                const team = $(tds[1]).text().trim();
                const pts = $(tds[2]).text().trim();
                
                // Si la position est un chiffre, c'est probablement une ligne de classement
                if (pos.match(/^\d+$/)) {
                    ranking.push({ 
                        position: pos, 
                        team: team, 
                        points: pts 
                    });
                }
            }
        });

        console.log(`✅ Extracted ${ranking.length} teams`);
        return ranking;
    } catch (error) {
        console.error("❌ Error scraping ranking:", error);
        return [];
    }
}

// ---------------- API ENDPOINTS ------------------

app.get("/api/calendar", async (req, res) => {
    const data = await scrapeCalendar();
    res.json(data);
});

app.get("/api/ranking", async (req, res) => {
    const data = await scrapeRanking();
    res.json(data);
});

// ---------------- SERVER --------------------------

app.get("/", (req, res) => {
    res.send("Rolskanet scraper V3 (Debug Mode) 🚀");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log("Server running on port " + port);
});
