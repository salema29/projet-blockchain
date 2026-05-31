const hre = require("hardhat");

async function main() {
    const CONTRACT_ADDRESS = "0x59A8C32Fc5A6F3F1b62C87f815946836D10E4c81";

    const vote = await hre.ethers.getContractAt("DecentralizedVote", CONTRACT_ADDRESS);

    const now = Math.floor(Date.now() / 1000);
    const startTime = now + 60;
    const endTime = now + 600;

    const tx = await vote.createElection(
        "Election delegue de classe",
        "Vote decentralise de demonstration",
        startTime,
        endTime,
        ["Candidat A", "Candidat B", "Candidat C"]
    );

    await tx.wait();

    console.log("Election creee avec succes !");
    console.log("Elle commencera dans environ 60 secondes.");
    console.log("ID de l'election : 1");
    console.log("Start time :", startTime);
    console.log("End time :", endTime);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});