let provider = null;
let signer = null;
let contrat = null;
let electionIdCourant = null;

const STATUTS = ["Planifiee", "Active", "Terminee", "Finalisee"];

const btnConnecter       = document.getElementById("btn-connecter");
const adresseWallet      = document.getElementById("adresse-wallet");
const reseau             = document.getElementById("reseau");
const btnCharger         = document.getElementById("btn-charger");
const inputElectionId    = document.getElementById("input-election-id");
const zoneElection       = document.getElementById("zone-election");
const sectionPropositions = document.getElementById("section-propositions");
const zonePropositions   = document.getElementById("zone-propositions");
const zoneVote           = document.getElementById("zone-vote");
const inputPropositionId = document.getElementById("input-proposition-id");
const btnVoter           = document.getElementById("btn-voter");
const chargement         = document.getElementById("chargement");
const sectionResultat    = document.getElementById("section-resultat");
const zoneResultat       = document.getElementById("zone-resultat");
const zoneMessages       = document.getElementById("zone-messages");

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
      afficherErreur("Mauvais reseau ! Passe sur Sepolia dans MetaMask.");
      return;
    }

    contrat = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    adresseWallet.textContent = `${adresse.slice(0, 6)}...${adresse.slice(-4)}`;
    reseau.textContent = "Sepolia Testnet";
    btnConnecter.textContent = "Connecte";
    btnConnecter.disabled = true;

    afficherSucces("Wallet connecte avec succes !");

  } catch (erreur) {
    if (erreur.code === 4001) {
      afficherErreur("Connexion refusee. Accepte la connexion dans MetaMask.");
    } else {
      afficherErreur("Erreur de connexion : " + erreur.message);
    }
  }
}

btnCharger.addEventListener("click", chargerElection);

async function chargerElection() {
  if (!contrat) {
    afficherErreur("Connecte-toi d'abord avec MetaMask.");
    return;
  }

  const id = parseInt(inputElectionId.value);
  if (!id || id < 1) {
    afficherErreur("Entre un ID d'election valide.");
    return;
  }

  try {
    const election = await contrat.getElection(id);
    electionIdCourant = id;

    document.getElementById("election-titre").textContent = election.title;
    document.getElementById("election-description").textContent = election.description;
    document.getElementById("election-statut").textContent = STATUTS[election.status] ?? election.status;
    document.getElementById("election-debut").textContent = new Date(Number(election.startTime) * 1000).toLocaleString();
    document.getElementById("election-fin").textContent = new Date(Number(election.endTime) * 1000).toLocaleString();
    document.getElementById("election-votes").textContent = election.totalVotes.toString();

    zoneElection.style.display = "block";

    await chargerPropositions(id, Number(election.status));

    if (Number(election.status) >= 2) {
      await afficherResultat(id);
    } else {
      sectionResultat.style.display = "none";
    }

  } catch (erreur) {
    afficherErreur("Election introuvable ou erreur : " + erreur.message);
    zoneElection.style.display = "none";
    sectionPropositions.style.display = "none";
    sectionResultat.style.display = "none";
  }
}

async function chargerPropositions(electionId, statut) {
  const propositions = await contrat.getProposals(electionId);
  const adresse = await signer.getAddress();
  const dejaVote = await contrat.hasVoted(electionId, adresse);

  zonePropositions.innerHTML = "";

  propositions.forEach((p) => {
    const div = document.createElement("div");
    div.classList.add("proposition");
    div.innerHTML = `<span class="proposition-id">#${p.id}</span><span class="proposition-nom">${p.name}</span><span class="proposition-votes">${p.voteCount} vote(s)</span>`;
    zonePropositions.appendChild(div);
  });

  sectionPropositions.style.display = "block";

  if (statut === 1 && !dejaVote) {
    zoneVote.style.display = "block";
  } else {
    zoneVote.style.display = "none";
    if (statut === 1 && dejaVote) {
      afficherInfo("Tu as deja vote pour cette election.");
    }
  }
}

async function afficherResultat(electionId) {
  const resultat = await contrat.getWinningProposal(electionId);

  zoneResultat.innerHTML = "";

  if (resultat.tie) {
    zoneResultat.innerHTML = `<p class="resultat-egalite">Egalite — aucun gagnant unique.</p>`;
  } else if (resultat.winnerProposalId.toString() === "0") {
    zoneResultat.innerHTML = `<p>Aucun vote enregistre.</p>`;
  } else {
    zoneResultat.innerHTML = `
      <div class="info-ligne"><span class="label">Gagnant</span><span>${resultat.winnerName}</span></div>
      <div class="info-ligne"><span class="label">Votes</span><span>${resultat.winningVoteCount}</span></div>
      <div class="info-ligne"><span class="label">Finalise</span><span>${resultat.finalized ? "Oui" : "Non"}</span></div>
    `;
  }

  sectionResultat.style.display = "block";
}

btnVoter.addEventListener("click", voter);

async function voter() {
  if (!contrat || !electionIdCourant) {
    afficherErreur("Charge une election d'abord.");
    return;
  }

  const propositionId = parseInt(inputPropositionId.value);
  if (!propositionId || propositionId < 1) {
    afficherErreur("Entre un ID de proposition valide.");
    return;
  }

  try {
    chargement.style.display = "block";
    btnVoter.disabled = true;
    btnVoter.textContent = "En cours...";

    const tx = await contrat.vote(electionIdCourant, propositionId);
    afficherInfo(`Transaction envoyee ! Hash : ${tx.hash.slice(0, 10)}...`);

    const recu = await tx.wait();
    afficherSucces(`Vote confirme ! Bloc : ${recu.blockNumber}`);

    await chargerElection();

  } catch (erreur) {
    if (erreur.code === 4001 || erreur.code === "ACTION_REJECTED") {
      afficherErreur("Transaction annulee. Tu as refuse dans MetaMask.");
    } else if (erreur.message.includes("revert")) {
      const match = erreur.message.match(/reason="([^"]+)"/);
      afficherErreur("Refuse par le contrat : " + (match ? match[1] : "condition non remplie"));
    } else {
      afficherErreur("Erreur : " + erreur.message);
    }
  } finally {
    chargement.style.display = "none";
    btnVoter.disabled = false;
    btnVoter.textContent = "Voter";
  }
}

if (typeof window.ethereum !== "undefined") {
  window.ethereum.on("accountsChanged", (comptes) => {
    if (comptes.length === 0) {
      reinitialiserConnexion();
      afficherInfo("Wallet deconnecte.");
    } else {
      reinitialiserConnexion();
      afficherInfo("Compte change. Reconnecte-toi.");
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
  electionIdCourant = null;
  adresseWallet.textContent = "Aucun wallet connecte";
  reseau.textContent = "Non connecte";
  btnConnecter.textContent = "Se connecter avec MetaMask";
  btnConnecter.disabled = false;
  zoneElection.style.display = "none";
  sectionPropositions.style.display = "none";
  sectionResultat.style.display = "none";
}

function afficherSucces(message) { afficherMessage(message, "succes"); }
function afficherErreur(message) { afficherMessage(message, "erreur"); }
function afficherInfo(message)   { afficherMessage(message, "info"); }

function afficherMessage(message, type) {
  zoneMessages.innerHTML = "";
  const div = document.createElement("div");
  div.classList.add("message", `message-${type}`);
  div.textContent = message;
  zoneMessages.appendChild(div);
  setTimeout(() => div.remove(), 6000);
}
