const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("EnhancedTWAPLimitOrderV2", function () {
  let contract, deployer, user, executor, makerAsset, takerAsset;
  let priceOracle, chainlinkRegistry;
  const ONEINCH_AGGREGATION_ROUTER = "0x111111125421cA6dc452d289314280a0f8842A65";
  const PRECISION = ethers.parseEther("1"); // 1e18
  const MIN_INTERVAL = 60; // 1 minute in seconds
  const MAX_SLIPPAGE = 1000; // 10%

  // Mock tokens (using mainnet addresses for forked environment)
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

  beforeEach(async function () {
    [deployer, user, executor] = await ethers.getSigners();

    // Mock price oracle and Chainlink registry addresses
    priceOracle = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419"; // ETH/USD Chainlink
    chainlinkRegistry = "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf";

    // Deploy the contract
    const EnhancedTWAPLimitOrderV2 = await ethers.getContractFactory("EnhancedTWAPLimitOrderV2");
    contract = await EnhancedTWAPLimitOrderV2.deploy(priceOracle, chainlinkRegistry);
    await contract.waitForDeployment();

    // Add executor
    await contract.addAuthorizedExecutor(executor.address);

    // Deploy mock tokens or use existing ones in forked environment
    makerAsset = await ethers.getContractAt("IERC20", WETH);
    takerAsset = await ethers.getContractAt("IERC20", DAI);

    // Fund user with tokens (impersonate a whale in forked mainnet)
    const whaleAddress = "0x28c6c06298d514db089934071355e5743bf21d60"; // Example DAI whale
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whaleAddress],
    });
    const whale = await ethers.getSigner(whaleAddress);
    await takerAsset.connect(whale).transfer(user.address, ethers.parseEther("1000"));
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [whaleAddress],
    });

    // Approve contract to spend user's tokens
    await takerAsset.connect(user).approve(contract.getAddress(), ethers.parseEther("1000"));
  });
  