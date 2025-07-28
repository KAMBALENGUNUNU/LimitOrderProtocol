const { ethers } = require("hardhat");

async function main() {
  // =============================================================================
  // MAINNET ADDRESSES (FOR FORKED DEPLOYMENT)
  // =============================================================================
  const MAINNET_1INCH_AGGREGATION_ROUTER = "0x111111125421cA6dc452d289314280a0f8842A65";
  const MAINNET_1INCH_LIMIT_ORDER_PROTOCOL = "0x119c71D3BbAC22029622cbaEc24854d3D32D2828";
  const MAINNET_CHAINLINK_REGISTRY = "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf";
  
  // For price oracle, you have 3 options:
  // 1. Use Chainlink Data Feeds directly (recommended for ETH/USD, BTC/USD pairs)
  // 2. Use 1inch Oracle (for token pairs)
  // 3. Deploy a custom TWAP oracle (only if needed)
  const PRICE_ORACLE = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"; // ETH/USD Chainlink feed

  console.log("Deploying EnhancedTWAPLimitOrderV2 to forked mainnet...");
  
  // =============================================================================
  // CONTRACT DEPLOYMENT
  // =============================================================================
  const EnhancedTWAPLimitOrderV2 = await ethers.getContractFactory("EnhancedTWAPLimitOrderV2");
  const contract = await EnhancedTWAPLimitOrderV2.deploy(
    PRICE_ORACLE,
    MAINNET_CHAINLINK_REGISTRY
  );

  await contract.waitForDeployment();
  
  console.log(`EnhancedTWAPLimitOrderV2 deployed to: ${await contract.getAddress()}`);

  // =============================================================================
  // POST-DEPLOYMENT SETUP
  // =============================================================================
  console.log("Performing post-deployment setup...");
  
  const [deployer] = await ethers.getSigners();
  
  // 1. Add deployer as authorized executor
  await contract.addAuthorizedExecutor(deployer.address);
  console.log(`Added deployer as authorized executor: ${deployer.address}`);

  // 2. Set protocol fee (0.1% as in your contract)
  await contract.setProtocolFee(10);
  console.log("Set protocol fee to 0.1%");

  // 3. Verify the contract (optional)
  console.log("Verifying contract...");
  try {
    await hre.run("verify:verify", {
      address: await contract.getAddress(),
      constructorArguments: [
        PRICE_ORACLE,
        MAINNET_CHAINLINK_REGISTRY
      ],
    });
  } catch (error) {
    console.log("Verification may have failed. This is normal on forked networks.");
    console.log("To verify, deploy to real mainnet and use Etherscan verification.");
  }

  console.log("Deployment and setup complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
  