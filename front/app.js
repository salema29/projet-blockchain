let provider = null;
let signer = null;
let contrat = null;
let electionIdCourant = null;
let adresseCourante = null;
let ownerCourant = null;

const STATUTS = ["Planifiee", "Active", "Terminee", "Finalisee"];

const btnConnecter = document.getElementById("btn-connecter");
const adresseWallet = document.getElementById("adresse-wallet");
const reseau = document.getElementById("reseau");
const contratAdresse = document.getElementById("contrat-adresse");
const contratAdresseCourte = document.getElementById("contrat-adresse-courte");
const contratOwner = document.getElementById("contrat-owner");
const contratElectionCount = document.getElementById("contrat-election-count");
const contratRole = document.getElementById("contrat-role");

const btnCreerElection = document.getElementById("btn-creer-election");
const inputCreateTitle = document.getElementById("input-create-title");
const inputCreateDescription = document.getElementById("input-create-description");
const inputCreateStart = document.getElementById("input-create-start");
const inputCreateEnd = document.getElementById("input-create-end");
const inputCreateProposals = document.getElementById("input-create-proposals");
const chargementCreer = document.getElementById("chargement-creer");

const btnAjouterProposition = document.getElementById("btn-ajouter-proposition");
const inputAddElectionId = document.getElementById("input-add-election-id");
const inputAddProposalName = document.getElementById("input-add-proposal-name");
const chargementAjout = document.getElementById("chargement-ajout");

const btnCharger = document.getElementById("btn-charger");
const inputElectionId = document.getElementById("input-election-id");
const zoneElection = document.getElementById("zone-election");
const sectionPropositions = document.getElementById("section-propositions");
const zonePropositions = document.getElementById("zone-propositions");
const zoneVote = document.getElementById("zone-vote");
const inputPropositionId = document.getElementById("input-proposition-id");
const btnVoter = document.getElementById("btn-voter");
const chargement = document.getElementById("chargement");
const sectionFinaliser = document.getElementById("section-finaliser");
const btnFinaliser = document.getElementById("btn-finaliser");
const chargementFinaliser = document.getElementById("chargement-finaliser");
const sectionResultat = document.getElementById("section-resultat");
const zoneResultat = document.getElementById("zone-resultat");
const zoneMessages = document.getElementById("zone-messages");

btnConnecter.addEventListener("click", connecterMetaMask);
btnCreerElection.addEventListener("click", creerElection);
btnAjouterProposition.addEventListener("click", ajouterProposition);
btnCharger.addEventListener("click", chargerElection);
btnVoter.addEventListener("click", voter);
btnFinaliser.addEventListener("click", finaliserElection);

initialiserResumeContrat();

async function connecterMetaMask() {
  if (typeof window.ethereum === "undefined") {
    afficherErreur("MetaMask n'est pas installe. Installe-le sur metamask.io");
    return;
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    adresseCourante = await signer.getAddress();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    if (chainId !== 11155111) {
      afficherErreur("Mauvais reseau ! Passe sur Sepolia dans MetaMask.");
      return;
    }

    contrat = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    ownerCourant = await contrat.owner();

    adresseWallet.textContent = raccourcirAdresse(adresseCourante);
    reseau.textContent = "Sepolia Testnet";
    btnConnecter.textContent = "Connecte";
    btnConnecter.disabled = true;

    await rafraichirResumeContrat();
    afficherSucces("Wallet connecte avec succes !");
  } catch (erreur) {
    if (erreur.code === 4001) {
      afficherErreur("Connexion refusee. Accepte la connexion dans MetaMask.");
    } else {
      afficherErreur("Erreur de connexion : " + (erreur.shortMessage ?? erreur.message));
    }
  }
}

async function rafraichirResumeContrat() {
  if (!contrat) {
    initialiserResumeContrat();
    return;
  }

  const owner = ownerCourant ?? await contrat.owner();
  const count = await contrat.getElectionCount();
  const estOwner = adresseCourante && owner.toLowerCase() === adresseCourante.toLowerCase();

  ownerCourant = owner;
  contratAdresse.textContent = CONTRACT_ADDRESS;
  contratAdresseCourte.textContent = raccourcirAdresse(CONTRACT_ADDRESS);
  contratOwner.textContent = raccourcirAdresse(owner);
  contratElectionCount.textContent = count.toString();
  contratRole.textContent = estOwner ? "Owner du contrat" : "Votant / visiteur";
}

async function creerElection() {
  if (!contrat) {
    afficherErreur("Connecte-toi d'abord avec MetaMask.");
    return;
  }

  if (!estOwner()) {
    afficherErreur("Seul l'owner du contrat peut creer une election.");
    return;
  }

  const title = inputCreateTitle.value.trim();
  const description = inputCreateDescription.value.trim();
  const proposals = extrairePropositions(inputCreateProposals.value);
  const startTime = convertirDatetimeLocalEnTimestamp(inputCreateStart.value);
  const endTime = convertirDatetimeLocalEnTimestamp(inputCreateEnd.value);

  if (!title) {
    afficherErreur("Entre un titre d'election.");
    return;
  }

  if (!description) {
    afficherErreur("Entre une description.");
    return;
  }

  if (!startTime || !endTime) {
    afficherErreur("Renseigne une date de debut et de fin valides.");
    return;
  }

  if (endTime <= startTime) {
    afficherErreur("La date de fin doit etre apres la date de debut.");
    return;
  }

  if (proposals.length < 2) {
    afficherErreur("Entre au moins deux propositions.");
    return;
  }

  try {
    chargementCreer.style.display = "block";
    btnCreerElection.disabled = true;
    btnCreerElection.textContent = "Creation...";

    const tx = await contrat.createElection(title, description, startTime, endTime, proposals);
    afficherInfo(`Creation envoyee ! Hash : ${tx.hash.slice(0, 10)}...`);

    const recu = await tx.wait();
    const electionId = await retrouverElectionIdDepuisReceipt(recu);

    afficherSucces(electionId
      ? `Election creee ! ID : ${electionId}`
      : `Election creee ! Bloc : ${recu.blockNumber}`);

    viderFormulaireCreation();
    await rafraichirResumeContrat();

    if (electionId) {
      inputElectionId.value = electionId;
      inputAddElectionId.value = electionId;
      await chargerElection();
    }
  } catch (erreur) {
    afficherErreur(extraireMessageErreur(erreur));
  } finally {
    chargementCreer.style.display = "none";
    btnCreerElection.disabled = false;
    btnCreerElection.textContent = "Creer l'election";
  }
}

async function ajouterProposition() {
  if (!contrat) {
    afficherErreur("Connecte-toi d'abord avec MetaMask.");
    return;
  }

  if (!estOwner()) {
    afficherErreur("Seul l'owner du contrat peut ajouter une proposition.");
    return;
  }

  const electionId = parseInt(inputAddElectionId.value, 10);
  const nom = inputAddProposalName.value.trim();

  if (!electionId || electionId < 1) {
    afficherErreur("Entre un ID d'election valide.");
    return;
  }

  if (!nom) {
    afficherErreur("Entre un nom de proposition.");
    return;
  }

  try {
    chargementAjout.style.display = "block";
    btnAjouterProposition.disabled = true;
    btnAjouterProposition.textContent = "Ajout...";

    const tx = await contrat.addProposal(electionId, nom);
    afficherInfo(`Ajout envoye ! Hash : ${tx.hash.slice(0, 10)}...`);

    const recu = await tx.wait();
    afficherSucces(`Proposition ajoutee ! Bloc : ${recu.blockNumber}`);

    inputAddProposalName.value = "";
    await rafraichirResumeContrat();

    if (electionIdCourant === electionId) {
      await chargerElection();
    }
  } catch (erreur) {
    afficherErreur(extraireMessageErreur(erreur));
  } finally {
    chargementAjout.style.display = "none";
    btnAjouterProposition.disabled = false;
    btnAjouterProposition.textContent = "Ajouter la proposition";
  }
}

async function chargerElection() {
  if (!contrat) {
    afficherErreur("Connecte-toi d'abord avec MetaMask.");
    return;
  }

  const id = parseInt(inputElectionId.value, 10);
  if (!id || id < 1) {
    afficherErreur("Entre un ID d'election valide.");
    return;
  }

  try {
    const election = await contrat.getElection(id);
    electionIdCourant = id;

    document.getElementById("election-titre").textContent = election.title;
    document.getElementById("election-description").textContent = election.description;
    document.getElementById("election-statut").textContent = STATUTS[Number(election.status)] ?? election.status;
    document.getElementById("election-debut").textContent = formaterTimestamp(election.startTime);
    document.getElementById("election-fin").textContent = formaterTimestamp(election.endTime);
    document.getElementById("election-votes").textContent = election.totalVotes.toString();

    zoneElection.style.display = "block";
    inputAddElectionId.value = id;

    await chargerPropositions(id, Number(election.status));

    sectionFinaliser.style.display = Number(election.status) === 2 ? "block" : "none";

    if (Number(election.status) >= 2) {
      await afficherResultat(id);
    } else {
      sectionResultat.style.display = "none";
    }
  } catch (erreur) {
    afficherErreur("Election introuvable ou erreur : " + (erreur.reason ?? erreur.shortMessage ?? erreur.message));
    zoneElection.style.display = "none";
    sectionPropositions.style.display = "none";
    sectionFinaliser.style.display = "none";
    sectionResultat.style.display = "none";
  }
}

async function chargerPropositions(electionId, statut) {
  const propositions = await contrat.getProposals(electionId);
  const dejaVote = adresseCourante ? await contrat.hasVoted(electionId, adresseCourante) : false;

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
    zoneResultat.innerHTML = `<p class="resultat-egalite">Egalite : aucun gagnant unique pour l'instant.</p>`;
  } else if (resultat.winnerProposalId.toString() === "0") {
    zoneResultat.innerHTML = "<p>Aucun vote enregistre.</p>";
  } else {
    zoneResultat.innerHTML = `
      <div class="info-ligne"><span class="label">Gagnant</span><span>${resultat.winnerName}</span></div>
      <div class="info-ligne"><span class="label">Votes</span><span>${resultat.winningVoteCount}</span></div>
      <div class="info-ligne"><span class="label">Finalise</span><span>${resultat.finalized ? "Oui" : "Non"}</span></div>
    `;
  }

  sectionResultat.style.display = "block";
}

async function voter() {
  if (!contrat || !electionIdCourant) {
    afficherErreur("Charge une election d'abord.");
    return;
  }

  const propositionId = parseInt(inputPropositionId.value, 10);
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
    afficherErreur(extraireMessageErreur(erreur));
  } finally {
    chargement.style.display = "none";
    btnVoter.disabled = false;
    btnVoter.textContent = "Voter";
  }
}

async function finaliserElection() {
  if (!contrat || !electionIdCourant) {
    afficherErreur("Charge une election d'abord.");
    return;
  }

  try {
    chargementFinaliser.style.display = "block";
    btnFinaliser.disabled = true;
    btnFinaliser.textContent = "En cours...";

    const tx = await contrat.finalizeElection(electionIdCourant);
    afficherInfo(`Transaction envoyee ! Hash : ${tx.hash.slice(0, 10)}...`);

    const recu = await tx.wait();
    afficherSucces(`Election finalisee ! Bloc : ${recu.blockNumber}`);

    await chargerElection();
  } catch (erreur) {
    afficherErreur(extraireMessageErreur(erreur));
  } finally {
    chargementFinaliser.style.display = "none";
    btnFinaliser.disabled = false;
    btnFinaliser.textContent = "Finaliser et enregistrer le resultat";
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

function initialiserResumeContrat() {
  contratAdresse.textContent = CONTRACT_ADDRESS;
  contratAdresseCourte.textContent = raccourcirAdresse(CONTRACT_ADDRESS);
  contratOwner.textContent = "-";
  contratElectionCount.textContent = "-";
  contratRole.textContent = "Visiteur";
}

function reinitialiserConnexion() {
  provider = null;
  signer = null;
  contrat = null;
  electionIdCourant = null;
  adresseCourante = null;
  ownerCourant = null;

  adresseWallet.textContent = "Aucun wallet connecte";
  reseau.textContent = "Non connecte";
  btnConnecter.textContent = "Se connecter avec MetaMask";
  btnConnecter.disabled = false;

  initialiserResumeContrat();
  zoneElection.style.display = "none";
  sectionPropositions.style.display = "none";
  sectionFinaliser.style.display = "none";
  sectionResultat.style.display = "none";
}

function estOwner() {
  return Boolean(
    adresseCourante &&
    ownerCourant &&
    ownerCourant.toLowerCase() === adresseCourante.toLowerCase()
  );
}

function extrairePropositions(valeur) {
  return valeur
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function convertirDatetimeLocalEnTimestamp(valeur) {
  if (!valeur) {
    return null;
  }

  const date = new Date(valeur);
  const timestamp = Math.floor(date.getTime() / 1000);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formaterTimestamp(timestamp) {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

async function retrouverElectionIdDepuisReceipt(recu) {
  for (const log of recu.logs) {
    try {
      const evenement = contrat.interface.parseLog(log);
      if (evenement && evenement.name === "ElectionCreated") {
        return evenement.args.electionId.toString();
      }
    } catch {
      // Ignore les logs non lies au contrat cible.
    }
  }

  return null;
}

function viderFormulaireCreation() {
  inputCreateTitle.value = "";
  inputCreateDescription.value = "";
  inputCreateStart.value = "";
  inputCreateEnd.value = "";
  inputCreateProposals.value = "";
}

function raccourcirAdresse(adresse) {
  if (!adresse || adresse.length < 10) {
    return adresse ?? "-";
  }

  return `${adresse.slice(0, 6)}...${adresse.slice(-4)}`;
}

function extraireMessageErreur(erreur) {
  if (erreur.code === 4001 || erreur.code === "ACTION_REJECTED") {
    return "Transaction annulee. Tu as refuse dans MetaMask.";
  }

  if (erreur.reason) {
    return "Refuse par le contrat : " + erreur.reason;
  }

  if (erreur.shortMessage) {
    return "Erreur : " + erreur.shortMessage;
  }

  if (erreur.message && erreur.message.includes("revert")) {
    const match = erreur.message.match(/reason="([^"]+)"/);
    return "Refuse par le contrat : " + (match ? match[1] : "condition non remplie");
  }

  return "Erreur : " + erreur.message;
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
