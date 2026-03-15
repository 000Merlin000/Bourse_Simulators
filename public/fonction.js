function getStoredInfo() {
  const raw = localStorage.getItem("info");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Impossible de parser localStorage info", e);
    return null;
  }
}

// Fonction pour importer des données utilisateur depuis le back
function user_data(callback){
  const stored = getStoredInfo();
  if (!stored || !stored.mail) return;

  fetch("http://localhost:3000/data",{
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mail: stored.mail })
  })
    .then(res => res.json())
    .then(data => {
      const portefeuille = JSON.parse(data.info.portefeuille);
      if (typeof callback === "function") callback(portefeuille);
    })
    .catch(err => console.error("Erreur user_data :", err));
}

// Voir si l'utilisateur est connecté
const storedInfoLocal = getStoredInfo();
const info_user = storedInfoLocal ? storedInfoLocal.mail : null;
if (info_user) {
  const div_login = document.getElementsByClassName("connection")[0];
  const connecter = document.getElementById("bt-connection");
  const p_argent = document.createElement("p");

  if (connecter && div_login) {
    div_login.removeChild(connecter);
    div_login.appendChild(p_argent);
  }

  p_argent.id = "p_argent";

  // récupère l'argent de l'utilisateur
  user_data((portefeuille) => {
    if (p_argent) {
      p_argent.innerHTML = `Argent : ${Number(portefeuille.money).toFixed(2)} €`;
    }
  });

  // mettre la photo de profil
  const a_pp = document.createElement("a");
  if (div_login) div_login.appendChild(a_pp);
  a_pp.id = "a_pp";
  a_pp.innerHTML = `<a href="/mon_compte"><img id="pp" src="./image/photo-utilisateur.png"></a>`;
}
function déconnection(){
    localStorage.removeItem("info")
    setInterval(()=>{
    window.location.href = "/" //retourne a l' accueil
    },500)
}
//template achat 
function template_achat(nombre,index,nom,initial_price,price){
    const div_portefeuille = document.getElementsByClassName("li")[0]
    const div_action = document.createElement("div")
    div_action.className = "action"
    div_action.id = `action-${index}`
    div_portefeuille.appendChild(div_action)

    function oriantation (){
      // `price` can be either a number or an object returned by the price API
      const current = price && typeof price === 'object' ? Number(price.price) : Number(price);
      const init = Number(initial_price);
      if (isNaN(current) || isNaN(init)) return null; // can't compare
      if (init < current){
        console.log(init, current)
        return [Number(100-(init/current)*100).toFixed(2),'#90EE90',`./image/north.png`]
      } else if (init > current){
        console.log(init, current)
        return [Number(100-(init/current)*100).toFixed(2),'red',`./image/south.png`]
      }
      return null; // equal price -> no icon
    }
     
    const icon = oriantation();
    const priceTotal = (Number(nombre) * Number(initial_price)).toFixed(2);
    div_action.innerHTML = `
      <span id="quantité-${index}">${nombre}x</span>
      <p style="font-weight: bolder; margin: 5px;">${nom}</p>
      <input type="number" class="input" min="0" name="" id="ip-sell-${index}">
      <button id="bt-sell-${index}" class="button">vendre</button>
      prix d' achat: <span>${priceTotal} €</span>
      ${icon ? `<p style="color:${icon[1]}">${icon[0]}%</p><img src="${icon[2]}" alt="orientation">` : ''}`
    //vendre
  document.getElementById(`bt-sell-${index}`).addEventListener("click", () => {
  let v_value = Number(document.getElementById(`ip-sell-${index}`).value);

  // Vérifier que la quantité à vendre est valide
  if (v_value <= 0 || v_value > nombre) {
    alert("Quantité invalide !");
    return;
  }

  // On récupère les données utilisateur d'abord
  user_data((p) => {
    const new_money = p.money + v_value * price;

    fetch("/exportation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mail: JSON.parse(localStorage.getItem("info")).mail,
        action: nom,
        quantité: -v_value, 
        money: new_money,
        price: price
      })
    })
      .then(res => res.json())
      .then((data) => {
        // Mise à jour de l'affichage
        afficher_portefeuillle(data.inf);
        document.getElementById("p_argent").innerHTML = `Argent : ${new_money} €`;
      })
      .catch(err => console.error("Erreur lors de la vente :", err));
  });
});

} 
//pour afficher tous le portefeuille
function afficher_portefeuillle(portefeuille){
    const div_portefeuille = document.getElementsByClassName("li")[0];
    div_portefeuille.innerHTML = "";
    // on récupère les prix actuels, puis on affiche chaque ligne avec le prix courant
    udapte_prix((prices) => {
      delete portefeuille.money;
      for (const [nom, valeurs] of Object.entries(portefeuille)) {
        const entreprise_info = typeof entreprises !== 'undefined' ? entreprises.find(e => e.nom === nom) : null;
        const dict_entreprise = entreprise_info ? prices.find(p => p && p.symbol === entreprise_info.code) : null;
        const currentPrice = dict_entreprise ? dict_entreprise.price : valeurs.initial_price;
        template_achat(
            valeurs.quantité,
            nom,
            nom,
            valeurs.initial_price,
            currentPrice);
      }
    });
}
//Génére les prix
function udapte_prix(callback){
  fetch("/prix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    .then(res => res.json())
    .then((data) => {
    const rep = data.ls;
    callback(rep)
})
}

//Classement des plus riches
function getTop(callback){
  fetch("/classement",{
    method: "POST",
    headers:{ "Content-Type": "application/json" }
  })
  .then(res => res.json())
  .then((data)=>{
    const users = data.profile || [];
    if (typeof callback === "function") callback(users);
  })
  .catch(err => console.error("Erreur /classement:", err));
}
