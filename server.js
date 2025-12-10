import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Fonction magique qui lance un vrai navigateur
async function scrapeWithBrowser(url, type) {
    console.log(`🚀 Launching browser for: ${url}`);
    
    // Configuration spéciale pour que ça marche sur Render (mémoire limitée)
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--single-process",
            "--no-zygote"
        ]
    });

    try {
        const page = await browser.newPage();
        
        // On se fait passer pour un utilisateur normal
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        
        // On va sur la page et on attend que le réseau soit calme (page chargée)
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // --- SCRAPING DIRECT DANS LA PAGE ---
        const data = await page.evaluate((type) => {
            const results = [];
            
            // On récupère toutes les lignes de tous les tableaux visibles
            const rows = document.querySelectorAll("tr");
            
            rows.forEach(row => {
                const tds = row.querySelectorAll("td");
                
                if (type === "calendar" && tds.length >= 3) {
                    // Logique Calendrier
                    const t1 = tds[0].innerText.trim();
                    const t2 = tds[1].innerText.trim();
                    const t3 = tds[2].innerText.trim();
                    
                    // Si la 1ere colonne contient un chiffre (date), on prend
                    if (t1.match(/\d/) && t2.length > 3) {
                        results.push({ date: t1, teams: t2, score: t3 });
                    }
                } 
                else if (type === "ranking" && tds.length >= 3) {
                    // Logique Classement
                    const p = tds[0].innerText.trim();
                    const t = tds[1].innerText.trim();
                    const pts = tds[2].innerText.trim();
                    
                    // Si la position est un nombre
                    if (p.match(/^\d+$/)) {
                        results.push({ position: p, team: t, points: pts });
                    }
                }
            });
            return results;
        }, type);

        console.log(`✅ Found ${data.length} items`);
        return data;

    } catch (error) {
        console.error("❌ Browser Error:", error);
        return [];
    } finally {
        await browser.close();
    }
}

// ---------------- API ENDPOINTS ------------------

app.get("/api/calendar", async (req, res) => {
    // Note: Le lancement du navigateur prend quelques secondes
    const data = await scrapeWithBrowser("https://rolskanet.fr/sportif/synthese/rencontres/RH", "calendar");
    res.json(data);
});

app.get("/api/ranking", async (req, res) => {
    const data = await scrapeWithBrowser("https://rolskanet.fr/sportif/synthese/classements/RH", "ranking");
    res.json(data);
});

// ---------------- SERVER --------------------------

app.get("/", (req, res) => {
    res.send("Rolskanet Scraper V4 (Puppeteer Edition) 🤖");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log("Server running on port " + port);
});
