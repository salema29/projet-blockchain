const hre = require("hardhat");

async function main() {
    const DecentralizedVote = await hre.ethers.getContractFactory("DecentralizedVote");

    const vote = await DecentralizedVote.deploy();

    await vote.waitForDeployment();

    const address = await vote.getAddress();

    console.log("DecentralizedVote deploye a l'adresse :");
    console.log(address);
    console.log("Lien Sepolia Etherscan :");
    console.log(`https://sepolia.etherscan.io/address/${address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});