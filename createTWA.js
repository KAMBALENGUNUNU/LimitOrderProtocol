const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  try {
    // 1. Get the contract ABI and address
    const contractAddress = "0xFEE2d383Ee292283eC43bdf0fa360296BE1e1149"; 
    const contractArtifact = await hre.artifacts.readArtifact("EnhancedTWAPLimitOrderV2");
    
    // 2. Get signers
    const [user] = await ethers.getSigners();
    console.log("Using account:", user.address);
    
    // 3. Check ETH balance
    const balance = await ethers.provider.getBalance(user.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");
    
    // 4. Create contract instance
    const contract = new ethers.Contract(
      contractAddress,
      contractArtifact.abi,
      user
    );