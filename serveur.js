const express =  require("express")
const app = express()
const port = 3000
const { join } = require("node:path")
//pour la sécuriter des pw
const bcrypt = require("bcrypt");

//création de la base de donné 
const Database = require("better-sqlite3");
const { userInfo } = require("node:os");
const { profile } = require("node:console");
const db = new Database("BD_user.db");
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    portefeuille TEXT NOT NULL
  )
`).run();

app.use(express.json());  // Pour lire le JSON dans req.body
app.use(express.static("public")); // lire les ficher css

let code_isin = ["TSLA","AMZN","AAPL","GOOGL","MSFT","NVDA"]
const API_KEY = "2WAnSbwMW62iNrR1VZz2oiSnvM6wjlAQ"
const API_KEY2 = "8tSDs5J01ctFPoqflZcCYHFeQWjKdHk2"
const apiKeys = [API_KEY, API_KEY2];
let apiKeyIndex = 0;
let dict_prix = [];
let dailyApiCalls = 0;
let lastDailyReset = new Date();

function getApiKey() {
  const key = apiKeys[apiKeyIndex];
  apiKeyIndex = (apiKeyIndex + 1) % apiKeys.length;
  return key;
}

function resetDailyApiCallsIfNeeded() {
  const now = new Date();
  if (now.toDateString() !== lastDailyReset.toDateString()) {
    dailyApiCalls = 0;
    lastDailyReset = now;
  }
}

let symbolIndex = 0;

async function udapte_prix() {
  resetDailyApiCallsIfNeeded();

  // Si on a presque atteint le quota, on évite de faire des appels inutiles
  if (dailyApiCalls >= 240) {
    console.warn(`Limite API proche (${dailyApiCalls}/250). Pas de nouvel appel pour l'instant.`);
    return;
  }

  for (const symbol of code_isin) {
    if (dailyApiCalls >= 250) {
      console.warn("Quota journalier atteint, arrêt des appels pour aujourd'hui.");
      break;
    }

    const apiKey = getApiKey();
    const url = `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${apiKey}`;

    try {
      const res = await fetch(url);

      // Si on a atteint la limite sur la clé actuelle, on essaye avec l'autre clé une fois
      if (res.status === 429) {
        console.warn("Quota API atteint pour cette clé, bascule sur une autre clé.");
        const secondKey = getApiKey();
        const retryUrl = `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${secondKey}`;
        const retryRes = await fetch(retryUrl);
        if (!retryRes.ok) {
          throw new Error(`Requête échouée après rotation de clé (code ${retryRes.status})`);
        }
        const retryData = await retryRes.json();
        updateDictPrixForSymbol(symbol, retryData);
        dailyApiCalls += 1;
        console.log(`Prix mis à jour (${symbol}) (après rotation de clé)`, new Date().toISOString());
        // Petite pause pour ne pas spammer trop vite
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      // 402 = paiement requis / quota dépassé sur le plan
      if (res.status === 402) {
        console.error("API renvoie 402 : clé non autorisée ou plan non valide. Vérifie ton abonnement ou utilise une autre clé.");
        // On bloque les appels pour éviter de spammer et de remplir la limite journalière
        dailyApiCalls = 250;
        break;
      }

      if (!res.ok) {
        throw new Error(`Requête échouée (code ${res.status})`);
      }

      const data = await res.json();
      updateDictPrixForSymbol(symbol, data);
      dailyApiCalls += 1;
      console.log(`Prix mis à jour (${symbol})`, new Date().toISOString(), `(${dailyApiCalls}/250 appels aujourd'hui)`);

      // Petite pause pour éviter de frapper l'API trop rapidement
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error("Erreur update prix :", err);
    }
  }
}

function updateDictPrixForSymbol(symbol, apiResponse) {
  const quote = Array.isArray(apiResponse) ? apiResponse[0] : apiResponse;
  if (!quote || quote.symbol !== symbol) return;

  // Remplace ou ajoute le prix pour ce symbole
  const existingIndex = dict_prix.findIndex((item) => item.symbol === symbol);
  if (existingIndex >= 0) {
    dict_prix[existingIndex] = quote;
  } else {
    dict_prix.push(quote);
  }
}

// Mise à jour périodique : 40 minutes = 216 appels/jour (6 symboles par cycle)
udapte_prix();
setInterval(() => {
  udapte_prix();
}, 40 * 60 * 1000);


//page pricipal
app.get("/", (req, res)=>{
     res.sendFile(join(__dirname,"./public/index.html"))
})

//page a propos
app.get("/page4", (req, res)=>{
    res.sendFile(join(__dirname,"./public/a_propos.html"))
})
//page d' achat d' action
app.get("/page3", (req, res)=>{
    res.sendFile(join(__dirname,"./public/action.html"))
})
//page de connection
app.get("/connection", (req, res)=>{
    res.sendFile(join(__dirname,"./public/connection.html"))
})
//page d' inscription 
app.get("/inscription", (req, res)=>{
    res.sendFile(join(__dirname,"./public/inscription.html"))
})
//page de gestion du compte
app.get("/mon_compte",(req,res)=>{
     res.sendFile(join(__dirname,"./public/compte.html"))
})

//généré les prix
app.post("/prix", (req,res)=>{
        res.json({ ls: dict_prix});
})
//vérificaltion que des donnée de connection
app.post("/info",(req,res)=>{
    const { mail, pw } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(mail);
    if (user && bcrypt.compareSync(pw, user.password)){
        res.json({message: true});
        console.log("Une nouvelle Connection :",mail)
    } else {
        res.json({message: false});
    }
});

//inscription de l' utilisateur
app.post("/inscriptionuser",(req,res)=>{
    
    const mail = req.body.mail
    const pw = req.body.password
    const nom = req.body.nom
    
    //Return une erreur si il y a un doublon
    const user_mail = db.prepare("SELECT * FROM users WHERE email = ? ").get(mail);
    const user_name = db.prepare("SELECT * FROM users WHERE username = ? ").get(nom)
    
    const résultat = {
        erreurMail: !user_mail,
        erreurName: !user_name,
        inscription: false
    }

    //enregitrement dans la base de donné 
    if (!user_mail && !user_name){
        const pw_bcrypt = bcrypt.hashSync(pw, 10)
        const portefeuille = {money:1000}
        const inser = db.prepare("INSERT INTO users (username, email, password, portefeuille) VALUES (?, ?, ?, ?)")
        inser.run(nom, mail, pw_bcrypt, JSON.stringify(portefeuille))
        résultat.inscription = true
        console.log("une inscription :", req.body.nom);
    } 
    res.json({résultat: résultat})
})
//exporte info  
app.post("/data",(req,res)=>{
    const user_info = req.body.mail
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(user_info)
    res.json({info: user})
})
//importation info
app.post("/exportation", (req,res)=>{
    const { action, quantité, money, mail, price } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(mail);
    let portefeuille = JSON.parse(user.portefeuille);

    // Si l’action existe déjà, on additionne
    if (portefeuille[action]) {
        portefeuille[action].quantité = Number(portefeuille[action].quantité) + Number(quantité);
        if (portefeuille[action].quantité == 0){
            delete portefeuille[action]
        }
    } else {
        portefeuille[action] = { quantité: Number(quantité), initial_price: price };
    }

    // On met à jour l’argent restant
    portefeuille.money = money;

    db.prepare("UPDATE users SET portefeuille = ? WHERE email = ?")
      .run(JSON.stringify(portefeuille), mail);

    console.log(`${mail} a acheté ${quantité}x ${action}`);
    res.json({ inf:portefeuille });
});

//suprimer le compte de l' utilisateur
app.post("/compte/supre", (req, res) => {
  const mail = req.body.mail;
  
  const supr = db.prepare("DELETE FROM users WHERE email = ?");
  supr.run(mail);

  console.log(`${mail} a supprimé son compte`);
  res.json({ success: true }); // renvoie une réponse au front
});

//classement des plus riche
app.post("/classement", (req, res) => {
  const users = db.prepare(`
    SELECT username, portefeuille
    FROM users
  `).all();

  const profile = users.map((u) => {
    let portefeuille = {}
    try {
      portefeuille = JSON.parse(u.portefeuille || "{}");
    } catch (e) {
      console.error("Erreur parse portefeuille for", u.username, e);
      portefeuille = {};
    }

    let total = 0;
    // Somme des actions
    for (const action in portefeuille) {
      if (action === "money") continue;
      const q = Number(portefeuille[action].quantité || 0);
      const price = Number(portefeuille[action].initial_price || 0);
      total += q * price;
    }
    // Ajout de l'argent disponible
    total += Number(portefeuille.money || 0);

    return { username: u.username, richess: total };
  });
  profile.sort((a, b) => b.richess - a.richess);
  res.json({ profile });

});


db.prepare("DELETE FROM users WHERE username = ?").run("bite")
console.log(`Nombre de utilisateurs : ${db.prepare("SELECT COUNT(*) FROM users").all()[0]["COUNT(*)"]}`)


app.listen(port,() => console.log(`le serveur est lancée sur http://localhost:${port} `))
