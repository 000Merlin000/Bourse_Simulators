const entreprises = [
  { nom: "Tesla", code: "TSLA", colors: "red" },
  { nom: "Amazon", code: "AMZN", colors: "#ff9900"},
  { nom: "Apple", code: "AAPL", colors: "#000000"},
  { nom: "Google", code: "GOOGL", colors: "#000000"},
  { nom: "Microsoft", code: "MSFT", colors: "#4285F4" },
  { nom: "Nvidia", code: "NVDA",colors:"#76b900"},

];
//actualisation grace au local storage
const data = JSON.parse(localStorage.getItem("info"));

if (data && data.mail) {

  user_data((portefeuille) => {

    // on enlève l'argent (pas une entreprise)
    delete portefeuille.money;

    // on met à jour les prix UNE SEULE FOIS
    udapte_prix((prix_list) => {

      // on parcourt les actions du portefeuille
      for (const [nom, values] of Object.entries(portefeuille)) {

        // chercher le code (symbol) correspondant au nom dans la liste `entreprises`
        const entreprise_info = entreprises.find(e => e.nom === nom);
        const dict_entreprise = entreprise_info ? prix_list.find(
          el => el && el.symbol === entreprise_info.code
        ) : null;

        // affichage (on passe la valeur numérique du prix actuel si disponible)
        template_achat(
          values.quantité,
          nom,
          nom,
          values.initial_price,
          dict_entreprise ? dict_entreprise.price : null
        );
      }

    });

  });

} 

//géneration des prix 
function géneration_prix (){
  const every_action = document.getElementsByClassName("toute-les-action")[0];
  // Si l'élément n'existe pas sur la page courante, ne rien faire
  if (!every_action) return;
  every_action.innerHTML = ""; // vider avant de générer

  udapte_prix((bourse_prix)=>{
    entreprises.forEach((entreprise, index) => {
      let dict_entreprise = bourse_prix.find(el => el.symbol === entreprise.code);
      let prix = dict_entreprise ? dict_entreprise.price : "N/A";

      const div = document.createElement("div");
      div.className = "action";
      div.innerHTML = `
        <p class="code_isin" style="background-color:${entreprise.colors}">${entreprise.code}</p>  
        <p style="font-weight: bolder; margin: 5px;">
            ${entreprise.nom} : <span>${prix} €</span>
        </p>
        <input type="number" min="0" id="inp-${index}" class="input">
        <button id="bt-${index}" class="button">Acheter</button>
      `;
      every_action.appendChild(div);

      //acheter
      document.getElementById(`bt-${index}`).addEventListener("click",()=>{
        user_data((portefeuille) => {
          let money = portefeuille.money;
          const value = Number(document.getElementById(`inp-${index}`).value);

          if(portefeuille.money >= value*prix){
            money = money - value*prix;
            fetch("/exportation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mail: JSON.parse(localStorage.getItem("info")).mail,
                action: entreprise.nom,
                quantité: value,
                money: money,
                price: prix
              })
            })
            .then(res => res.json())
            .then((data) => {
              afficher_portefeuillle(data.inf);
              if(document.getElementById("p_argent")){
                document.getElementById("p_argent").innerHTML = `Argent : ${money} €`;
              }
            })
          }
        })
      })
    })
  })
}
géneration_prix()
setInterval(()=>{
  géneration_prix()
},600000)
