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

     const wethContract = new ethers.Contract(WETH, wethAbi, user);
    
    // 7. Check WETH balance
    const wethBalance = await wethContract.balanceOf(user.address);
    console.log("Initial WETH balance:", ethers.formatEther(wethBalance));
    
    if (wethBalance < ethers.parseEther("10")) {
      console.log("Insufficient WETH balance - depositing ETH to get WETH...");
      
      // Deposit ETH to get WETH
      const depositTx = await wethContract.deposit({
        value: ethers.parseEther("10")
      });
      await depositTx.wait();
      console.log("Deposited 10 ETH for WETH");
    }
    
     
    // 8. Verify new WETH balance
    const newWethBalance = await wethContract.balanceOf(user.address);
    console.log("New WETH balance:", ethers.formatEther(newWethBalance));
    
    // 9. Approve contract to spend WETH
    console.log("Approving WETH spend...");
    const approveTx = await wethContract.approve(
      contractAddress,
      ethers.parseEther("10")
    );
    await approveTx.wait();
    console.log("Approval confirmed");
    
    // 10. Verify allowance (now with correct ABI)
    const allowance = await wethContract.allowance(user.address, contractAddress);
    console.log("Allowance amount:", ethers.formatEther(allowance));
    
    
    // 11. Create TWAP order
    console.log("Creating TWAP order...");
    const tx = await contract.createTWAPOrder(
      WETH,
      DAI,
      ethers.parseEther("10"),
      ethers.parseEther("2"),
      300, // 5 minutes in seconds
      ethers.parseEther("1800"), // price limit
      Math.floor(Date.now()/1000) + 86400, // 1 day from now
      500, // 5% slippage
      "0x", // predicateData
      "0x", // preInteractionData
      "0x", // postInteractionData
      { gasLimit: 1500000 } // Increased gas limit
    );
    
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction mined in block:", receipt.blockNumber);

     
    // 12. Check for order creation event
    const event = receipt.events?.find(x => x.event === "StrategyOrderCreated");
    if (event) {
      console.log(`TWAP Order created with ID: ${event.args.orderId}`);
    } else {
      console.log("Order creation failed - no event found");
      console.log("Full receipt:", receipt);
    }
  } catch (error) {
    console.error("Error details:", error);
    
    // Enhanced error logging
    if (error.receipt) {
      console.log("Transaction receipt:", error.receipt);
    }