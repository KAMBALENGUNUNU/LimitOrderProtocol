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

    console.log("WETH balance:", ethers.formatEther(await weth.balanceOf(user.address)));
    
    // 4. Approve and create order
    await weth.connect(user).approve(twap.getAddress(), ethers.parseEther("10"));
    
    // 5. Create TWAP order
    console.log("Creating TWAP order...");
    const tx = await twap.connect(user).createTWAPOrder(
      WETH,
      DAI,
      ethers.parseEther("10"),
      ethers.parseEther("2"),
      300, // 5 minutes
      ethers.parseEther("1800"), // price limit
      Math.floor(Date.now()/1000) + 86400, // 1 day from now
      500, // 5% slippage
      "0x", // predicate
      "0x", // pre-interaction
        "0x", // post-interaction
      { gasLimit: 2000000 } // Increased gas limit
    );
    
    // 6. Get the receipt and decode events
    const receipt = await tx.wait();
    console.log("Transaction completed in block:", receipt.blockNumber);
    
    // 7. Find the StrategyOrderCreated event
    const event = receipt.logs
      .map(log => {
        try {
          return twap.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .find(event => event && event.name === "StrategyOrderCreated");
      
    if (event) {
      console.log("\nOrder created successfully!");
      console.log("Order ID:", event.args.orderId);
      console.log("Maker:", event.args.maker);
      console.log("Strategy Type:", event.args.strategyType);
      console.log("Amount:", ethers.formatEther(event.args.totalAmount));
      
      // Verify order exists in contract storage
      const orderDetails = await twap.strategyOrders(event.args.orderId);
      console.log("\nOrder details from contract:", {
        maker: orderDetails.maker,
        makerAsset: orderDetails.makerAsset,
        takerAsset: orderDetails.takerAsset,
        totalMakingAmount: ethers.formatEther(orderDetails.totalMakingAmount),
        status: orderDetails.status
      });
      