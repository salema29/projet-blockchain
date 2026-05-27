let provider = null;
let signer = null;
let contrat = null;

const btnConnecter  = document.getElementById("btn-connecter");
const adresseWallet = document.getElementById("adresse-wallet");
const reseau        = document.getElementById("reseau");
const btnLire       = document.getElementById("btn-lire");
const valeurContrat = document.getElementById("valeur-contrat");
const inputValeur   = document.getElementById("input-valeur");
const btnEnvoyer    = document.getElementById("btn-envoyer");
const chargement    = document.getElementById("chargement");
const zoneMessages  = document.getElementById("zone-messages");

btnConnecter.addEventListener("click", connecterMetaMask);

async function connecterMetaMask() {
  if (typeof window.ethereum === "undefined") {
    afficherErreur("MetaMask n'est pas installe. Installe-le sur metamask.io");
    return;
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    const adresse = await signer.getAddress();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    if (chainId !== 11155111) {
      afficherErreur(`Mauvais reseau ! Passe sur Sepolia dans MetaMask.`);
      return;
    }

    contrat = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    adresseWallet.textContent = `${adresse.slice(0, 6)}...${adresse.slice(-4)}`;
    reseau.textContent = "Sepolia Testnet";
    btnConnecter.textContent = "Connecte";
    btnConnecter.disabled = true;

    afficherSucces("Wallet connecte avec succes !");
    await lireDonnees();

  } catch (erreur) {
    if (erreur.code === 4001) {
      afficherErreur("Connexion refusee. Accepte la connexion dans MetaMask.");
    } else {
      afficherErreur("Erreur de connexion : " + erreur.message);
    }
  }
}

btnLire.addEventListener("click", lireDonnees);

async function lireDonnees() {
  if (!contrat) {
    afficherErreur("Connecte-toi d'abord avec MetaMask.");
    return;
  }

  try {
    const valeur = await contrat.lire();
    valeurContrat.textContent = valeur.toString();
  } catch (erreur) {
    afficherErreur("Erreur lors de la lecture : " + erreur.message);
  }
}

btnEnvoyer.addEventListener("click", envoyerTransaction);

async function envoyerTransaction() {
  if (!contrat) {
    afficherErreur("Connecte-toi d'abord avec MetaMask.");
    return;
  }

  const valeurSaisie = inputValeur.value.trim();

  if (valeurSaisie === "") {
    afficherErreur("Remplis le champ avant d'envoyer.");
    return;
  }

  try {
    chargement.style.display = "block";
    btnEnvoyer.disabled = true;
    btnEnvoyer.textContent = "En cours...";

    const tx = await contrat.stocker(valeurSaisie);
    afficherInfo(`Transaction envoyee ! Hash : ${tx.hash.slice(0, 10)}...`);

    const recu = await tx.wait();
    afficherSucces(`Transaction confirmee ! Bloc : ${recu.blockNumber}`);
    await lireDonnees();

  } catch (erreur) {
    if (erreur.code === 4001 || erreur.code === "ACTION_REJECTED") {
      afficherErreur("Transaction annulee. Tu as refuse dans MetaMask.");
    } else if (erreur.message.includes("revert")) {
      const match = erreur.message.match(/reason="([^"]+)"/);
      const messageErreur = match ? match[1] : "Condition du contrat non remplie.";
      afficherErreur("Le contrat a rejete la transaction : " + messageErreur);
    } else {
      afficherErreur("Erreur : " + erreur.message);
    }
  } finally {
    chargement.style.display = "none";
    btnEnvoyer.disabled = false;
    btnEnvoyer.textContent = "Envoyer la transaction";
  }
}

if (typeof window.ethereum !== "undefined") {
  window.ethereum.on("accountsChanged", (comptes) => {
    if (comptes.length === 0) {
      reinitialiserConnexion();
      afficherInfo("Wallet deconnecte.");
    } else {
      afficherInfo("Compte change. Reconnecte-toi.");
      reinitialiserConnexion();
    }
  });

  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });
}

function reinitialiserConnexion() {
  provider = null;
  signer = null;
  contrat = null;
  adresseWallet.textContent = "Aucun wallet connecte";
  reseau.textContent = "Non connecte";
  btnConnecter.textContent = "Se connecter avec MetaMask";
  btnConnecter.disabled = false;
  valeurContrat.textContent = "-";
}

function afficherSucces(message) {
  afficherMessage(message, "succes");
}

function afficherErreur(message) {
  afficherMessage(message, "erreur");
}

function afficherInfo(message) {
  afficherMessage(message, "info");
}

function afficherMessage(message, type) {
  zoneMessages.innerHTML = "";
  const div = document.createElement("div");
  div.classList.add("message", `message-${type}`);
  div.textContent = message;
  zoneMessages.appendChild(div);
  setTimeout(() => div.remove(), 6000);
}
