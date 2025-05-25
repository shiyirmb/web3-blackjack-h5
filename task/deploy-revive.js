const { task } = require("hardhat/config");
const { readFileSync } = require('fs');
const { join } = require('path');

task("deploy-revive", "Deploys a contract")
  .addParam("contract", "The contract name")
  .addParam("args", "Constructor arguments (comma-separated)")
  .setAction(async (taskArgs, hre) => {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    const contractName = taskArgs.contract.split('.')[0];

    try {
      const abi = JSON.parse(readFileSync(join('artifacts', 'contracts', contractName, `${contractName}.json`), 'utf8'));
      const bytecode = `0x${readFileSync(join('artifacts', 'contracts', contractName, `${contractName}.polkavm`)).toString('hex')}`;

      // Create contract factory and deploy
      const factory = new hre.ethers.ContractFactory(abi, bytecode, deployer);
      const contract = await factory.deploy();

      // Wait for deployment to finish
      await contract.deployed();
      console.log(`${contractName} deployed to:`, contract.address);
    } catch (error) {
      console.error("Deployment failed:", error);
      process.exit(1);
    }
  });