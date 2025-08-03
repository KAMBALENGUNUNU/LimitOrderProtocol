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