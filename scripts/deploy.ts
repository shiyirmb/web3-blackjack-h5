import { ethers } from "hardhat";

async function main() {
  const BlackjackNFT = await ethers.getContractFactory("BlackjackNFT");
  const nft = await BlackjackNFT.deploy();

  // 等待合约部署完成
  await nft.deployed();
  console.log("BlackjackNFT deployed to:", nft.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});