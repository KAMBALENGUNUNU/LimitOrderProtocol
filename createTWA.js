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

        // 5. Token addresses
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    
    // 6. Get complete WETH ABI including all needed functions
    const wethAbi = [
      // Standard ERC-20 functions
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)",
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function allowance(address owner, address spender) external view returns (uint256)",
      
      // WETH-specific functions
      "function deposit() payable",
      "function withdraw(uint256 wad)"
    ];