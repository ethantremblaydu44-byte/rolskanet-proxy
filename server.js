import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

/**
 * FONCTION PRINCIPALE DE SCRAPING
 * Lance un navigateur Chrome invisible pour lire la page
 */
async function scrapeWithBrowser(url, type) {
    console.log(`🚀 Launching browser for: ${url}`);
    
    let browser = null;

    try {
        // Configuration optimisée pour Render (pour ne pas utiliser trop de mémoire)
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process', 
                '--no-zygote'
            ]
        });

        const page = await browser.newPage();
        
        // On se fait passer pour un vrai utilisateur PC
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        // On va sur l'URL et on attend que le réseau se calme (que la page soit chargée)
        await page.goto(url, { 
            waitUntil: 'networkidle2', 
            timeout: 60000 // On laisse 60 secondes max
        });

        // --- INJECTION DE CODE DANS LA PAGE DU NAVIGATEUR ---
        const data = await page.evaluate((type) => {
            const results = [];
            
            // On récupère toutes les lignes de tous les tableaux
            const rows = document.querySelectorAll("tr");
            
            rows.forEach(row => {
                const tds = row.querySelectorAll("td");
                
                // --- LOGIQUE CALENDRIER ---
                if (type === "calendar" && tds.length >= 3) {
                    const t1 = tds[0].innerText.trim(); // Date ?
                    const t2 = tds[1].innerText.trim(); // Equipes ?
                    const t3 = tds[2].innerText.trim(); // Score ?
                    
                    // Si la colonne 1 contient un chiffre (c'est une date)
                    if (t1.match(/\d/)) {
                        results.push({ date: t1, teams: t2, score: t3 });
                    }
                } 
                // --- LOGIQUE CLASSEMENT ---
                else if (type === "ranking" && tds.length >= 3) {
                    const p = tds[0].innerText.trim(); // Position
                    const t = tds[1].innerText.trim(); // Equipe
                    const pts = tds[2].innerText.trim(); // Points
                    
                    // Si la position est un chiffre
                    if (p.match(/^\d+$/)) {
                        results.push({ position: p, team: t, points: pts });
                    }
                }
            });
            return results;
        }, type);

        console.log(`✅ Scraped ${data.length} items from ${type}`);
        return data;

    } catch (error) {
        console.error("❌ Browser Error:", error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

// ---------------- API ENDPOINTS ------------------

app.get("/api/calendar", async (req, res) => {
    // Attention : Puppeteer est plus lent, cela peut prendre 5 à 10 secondes
    const data = await scrapeWithBrowser("https://rolskanet.fr/sportif/synthese/rencontres/RH", "calendar");
    res.json(data);
});

app.get("/api/ranking", async (req, res) => {
    const data = await scrapeWithBrowser("https://rolskanet.fr/sportif/synthese/classements/RH", "ranking");
    res.json(data);
});

// ---------------- SERVER --------------------------

app.get("/", (req, res) => {
    res.send("Rolskanet Scraper V4 (Puppeteer Edition) is Running 🤖");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log("Server running on port " + port);
});
