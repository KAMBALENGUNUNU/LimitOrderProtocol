const { ethers } = require("hardhat");
const { expect } = require("chai");

async function main() {
  try {
    // 1. Get contract instance
    const EnhancedTWAP = await ethers.getContractFactory("EnhancedTWAPLimitOrderV2");
    const twap = await EnhancedTWAP.deploy(
      "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // Chainlink ETH/USD
      "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf"  // Chainlink registry
    );
    await twap.waitForDeployment();

        // 2. Get test accounts
    const [user, deployer] = await ethers.getSigners();
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    
    // 3. Get WETH through deposit (better than impersonation)
    console.log("Getting WETH through deposit...");
    const weth = await ethers.getContractAt("IWETH", WETH);
    
    // Deposit ETH to get WETH
    await weth.connect(user).deposit({
      value: ethers.parseEther("10")
    });