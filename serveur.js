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
let dict_prix = [];

async function udapte_prix() {//async permet d' attendre l' a réponse avant de continue 
  try {
    // Récupère les prix de toutes les actions en même temps
    const results = await Promise.all(//attends que toutes mes promesses soient terminées avant de continuer
      code_isin.map(async (code) => {
        const res = await fetch(`https://financialmodelingprep.com/stable/quote?symbol=${code}&apikey=${API_KEY2}`);
        const data = await res.json();
        return data[0]; // le prix de l’action
      })
    );

    // Met à jour la liste des prix
    dict_prix = results;
    console.log("Prix mis à jour");

  } catch (err) {
    console.error("Erreur update prix :", err);
  }
}


udapte_prix()
//demande a la base de donné les prix tous les 10min
setInterval(()=>{
    udapte_prix()

}, 600000)


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
