const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DecentralizedVote", function () {
  let contrat;
  let owner;
  let votant1;
  let votant2;
  let votant3;

  // Helpers temporels
  const maintenant = async () => await time.latest();
  const dansUneHeure = async () => (await maintenant()) + 3600;
  const dansDeuxHeures = async () => (await maintenant()) + 7200;

  beforeEach(async function () {
    [owner, votant1, votant2, votant3] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DecentralizedVote");
    contrat = await Factory.deploy();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Création d'élection
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Création d'élection", function () {
    it("crée une élection et émet ElectionCreated", async function () {
      const debut = await dansUneHeure();
      const fin = await dansDeuxHeures();

      await expect(
        contrat.createElection(
          "Election test",
          "Description test",
          debut,
          fin,
          ["Candidat A", "Candidat B"]
        )
      )
        .to.emit(contrat, "ElectionCreated")
        .withArgs(1, "Election test", debut, fin);

      expect(await contrat.getElectionCount()).to.equal(1);
    });

    it("retourne les données correctes de l'élection créée", async function () {
      const debut = await dansUneHeure();
      const fin = await dansDeuxHeures();

      await contrat.createElection(
        "Présidentielle",
        "Vote présidentiel",
        debut,
        fin,
        ["Alice", "Bob", "Charlie"]
      );

      const election = await contrat.getElection(1);
      expect(election.title).to.equal("Présidentielle");
      expect(election.proposalCount).to.equal(3);
      expect(election.totalVotes).to.equal(0);
    });

    it("rejette une élection sans titre", async function () {
      const debut = await dansUneHeure();
      const fin = await dansDeuxHeures();

      await expect(
        contrat.createElection("", "desc", debut, fin, ["A", "B"])
      ).to.be.revertedWith("Title cannot be empty");
    });

    it("rejette une élection avec moins de 2 propositions", async function () {
      const debut = await dansUneHeure();
      const fin = await dansDeuxHeures();

      await expect(
        contrat.createElection("Test", "desc", debut, fin, ["A"])
      ).to.be.revertedWith("At least two proposals are required");
    });

    it("rejette si un non-owner essaie de créer une élection", async function () {
      const debut = await dansUneHeure();
      const fin = await dansDeuxHeures();

      await expect(
        contrat
          .connect(votant1)
          .createElection("Test", "desc", debut, fin, ["A", "B"])
      ).to.be.revertedWith("Only the owner can call this function");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Vote unique par adresse
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Vote unique par adresse", function () {
    let electionId;

    beforeEach(async function () {
      // Élection qui commence immédiatement (startTime dans le passé)
      const debut = (await maintenant()) - 1;
      const fin = await dansDeuxHeures();

      await contrat.createElection(
        "Election active",
        "desc",
        debut,
        fin,
        ["Proposition 1", "Proposition 2"]
      );
      electionId = 1;
    });

    it("accepte un premier vote et émet VoteCast", async function () {
      await expect(contrat.connect(votant1).vote(electionId, 1))
        .to.emit(contrat, "VoteCast")
        .withArgs(electionId, 1, votant1.address);

      const election = await contrat.getElection(electionId);
      expect(election.totalVotes).to.equal(1);
    });

    it("refuse un deuxième vote du même votant", async function () {
      await contrat.connect(votant1).vote(electionId, 1);

      await expect(
        contrat.connect(votant1).vote(electionId, 2)
      ).to.be.revertedWith("You have already voted in this election");
    });

    it("permet à plusieurs votants différents de voter", async function () {
      await contrat.connect(votant1).vote(electionId, 1);
      await contrat.connect(votant2).vote(electionId, 1);
      await contrat.connect(votant3).vote(electionId, 2);

      const election = await contrat.getElection(electionId);
      expect(election.totalVotes).to.equal(3);

      const proposition1 = await contrat.getProposal(electionId, 1);
      expect(proposition1.voteCount).to.equal(2);

      const proposition2 = await contrat.getProposal(electionId, 2);
      expect(proposition2.voteCount).to.equal(1);
    });

    it("enregistre correctement le choix du votant", async function () {
      await contrat.connect(votant1).vote(electionId, 2);

      const choix = await contrat.getVoterChoice(electionId, votant1.address);
      expect(choix).to.equal(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Refus de vote après la deadline
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Refus de vote après la deadline", function () {
    it("refuse un vote quand l'élection est terminée", async function () {
      const debut = (await maintenant()) - 1;
      const fin = (await maintenant()) + 60; // expire dans 60 secondes

      await contrat.createElection(
        "Election courte",
        "desc",
        debut,
        fin,
        ["Oui", "Non"]
      );

      // Avance le temps après la deadline
      await time.increaseTo(fin + 1);

      await expect(
        contrat.connect(votant1).vote(1, 1)
      ).to.be.revertedWith("Election is not active");
    });

    it("refuse un vote quand l'élection n'a pas encore commencé", async function () {
      const debut = await dansUneHeure(); // commence dans le futur
      const fin = await dansDeuxHeures();

      await contrat.createElection(
        "Election future",
        "desc",
        debut,
        fin,
        ["A", "B"]
      );

      await expect(
        contrat.connect(votant1).vote(1, 1)
      ).to.be.revertedWith("Election is not active");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Calcul du gagnant (finalizeElection)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Calcul du gagnant", function () {
    let electionId;
    let fin;

    beforeEach(async function () {
      const debut = (await maintenant()) - 1;
      fin = (await maintenant()) + 120;

      await contrat.createElection(
        "Election finale",
        "desc",
        debut,
        fin,
        ["Alice", "Bob"]
      );
      electionId = 1;
    });

    it("finalise l'élection et désigne le gagnant correct", async function () {
      await contrat.connect(votant1).vote(electionId, 1); // Alice
      await contrat.connect(votant2).vote(electionId, 1); // Alice
      await contrat.connect(votant3).vote(electionId, 2); // Bob

      await time.increaseTo(fin + 1);

      await expect(contrat.finalizeElection(electionId))
        .to.emit(contrat, "ElectionFinalized")
        .withArgs(electionId, 1, false, 3);

      const [winnerId, winnerName, , tie, finalized] =
        await contrat.getWinningProposal(electionId);

      expect(winnerId).to.equal(1);
      expect(winnerName).to.equal("Alice");
      expect(tie).to.equal(false);
      expect(finalized).to.equal(true);
    });

    it("refuse de finaliser avant la deadline", async function () {
      await expect(
        contrat.finalizeElection(electionId)
      ).to.be.revertedWith("Election deadline has not been reached");
    });

    it("refuse une double finalisation", async function () {
      await time.increaseTo(fin + 1);
      await contrat.finalizeElection(electionId);

      await expect(
        contrat.finalizeElection(electionId)
      ).to.be.revertedWith("Election already finalized");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Cas d'égalité (tie)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Cas d'égalité (tie)", function () {
    it("détecte une égalité entre deux propositions", async function () {
      const debut = (await maintenant()) - 1;
      const fin = (await maintenant()) + 120;

      await contrat.createElection(
        "Election egalite",
        "desc",
        debut,
        fin,
        ["Candidat X", "Candidat Y"]
      );

      // Un vote chacun → égalité
      await contrat.connect(votant1).vote(1, 1);
      await contrat.connect(votant2).vote(1, 2);

      await time.increaseTo(fin + 1);

      await expect(contrat.finalizeElection(1))
        .to.emit(contrat, "ElectionFinalized")
        .withArgs(1, 0, true, 2); // winnerId=0 car tie

      const [winnerId, , , tie] = await contrat.getWinningProposal(1);
      expect(tie).to.equal(true);
      expect(winnerId).to.equal(0);
    });

    it("getWinningProposal retourne tie=true même sans finalisation", async function () {
      const debut = (await maintenant()) - 1;
      const fin = (await maintenant()) + 120;

      await contrat.createElection(
        "Election egalite live",
        "desc",
        debut,
        fin,
        ["P1", "P2"]
      );

      await contrat.connect(votant1).vote(1, 1);
      await contrat.connect(votant2).vote(1, 2);

      const [, , , tie] = await contrat.getWinningProposal(1);
      expect(tie).to.equal(true);
    });
  });
});
