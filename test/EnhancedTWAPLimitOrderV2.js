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
   describe("TWAP Order", function () {
    it("should create and execute a TWAP order", async function () {
      const totalAmount = ethers.parseEther("10");
      const intervalAmount = ethers.parseEther("2");
      const intervalDuration = MIN_INTERVAL;
      const priceLimit = ethers.parseEther("1");
      const deadline = (await time.latest()) + 86400; // 1 day from now
      const slippageTolerance = 500; // 5%
      const predicateData = "0x";
      const preInteractionData = "0x";
      const postInteractionData = "0x";

      // Create TWAP order
      const tx = await contract.connect(user).createTWAPOrder(
        WETH,
        DAI,
        totalAmount,
        intervalAmount,
        intervalDuration,
        priceLimit,
        deadline,
        slippageTolerance,
        predicateData,
        preInteractionData,
        postInteractionData
      );

      const receipt = await tx.wait();
      const orderId = receipt.logs
        .filter((log) => log.eventName === "StrategyOrderCreated")[0]
        .args.orderId;

      // Verify order creation
      const order = await contract.getOrderDetails(orderId);
      expect(order.order.maker).to.equal(user.address);
      expect(order.order.totalMakingAmount).to.equal(totalAmount);
      expect(order.order.strategyType).to.equal(0); // TWAP
      expect(order.order.status).to.equal(1); // ACTIVE

      // Mock swap data (simplified for test)
      const swapData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "uint256"],
        [WETH, DAI, intervalAmount, ethers.parseEther("2000")] // Mock 1 WETH = 2000 DAI
      );

      // Advance time for TWAP execution
      await time.increase(intervalDuration + 1);

      // Execute TWAP order
      await expect(
        contract.connect(executor).executeTWAPOrder(orderId, swapData, ethers.parseEther("1900")) // Min amount out with slippage
      )
        .to.emit(contract, "OrderExecuted")
        .withArgs(
          orderId,
          1,
          intervalAmount,
          ethers.parseEther("2000"),
          ethers.parseEther("2000"), // Execution price
          executor.address
        );

      // Verify updated state
      const updatedOrder = await contract.getOrderDetails(orderId);
      expect(updatedOrder.order.remainingMakingAmount).to.equal(totalAmount - intervalAmount);
      expect(updatedOrder.order.executionCount).to.equal(1);
    });

    it("should fail if interval not elapsed", async function () {
      const totalAmount = ethers.parseEther("10");
      const intervalAmount = ethers.parseEther("2");
      const intervalDuration = MIN_INTERVAL;
      const priceLimit = ethers.parseEther("1");
      const deadline = (await time.latest()) + 86400;
      const slippageTolerance = 500;

      const tx = await contract.connect(user).createTWAPOrder(
        WETH,
        DAI,
        totalAmount,
        intervalAmount,
        intervalDuration,
        priceLimit,
        deadline,
        slippageTolerance,
        "0x",
        "0x",
        "0x"
      );

      const receipt = await tx.wait();
      const orderId = receipt.logs
        .filter((log) => log.eventName === "StrategyOrderCreated")[0]
        .args.orderId;

      const swapData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "uint256"],
        [WETH, DAI, intervalAmount, ethers.parseEther("2000")]
      );

      await expect(
        contract.connect(executor).executeTWAPOrder(orderId, swapData, ethers.parseEther("1900"))
      ).to.be.revertedWith("Too early for execution");
    });
  });
  
  describe("Grid Trading Order", function () {
    it("should create and execute a grid trading order", async function () {
      const totalAmount = ethers.parseEther("10");
      const gridLevels = 5;
      const lowerPrice = ethers.parseEther("1500");
      const upperPrice = ethers.parseEther("2500");
      const deadline = (await time.latest()) + 86400;

      const tx = await contract.connect(user).createGridTradingOrder(
        WETH,
        DAI,
        totalAmount,
        gridLevels,
        lowerPrice,
        upperPrice,
        deadline
      );

      const receipt = await tx.wait();
      const orderId = receipt.logs
        .filter((log) => log.eventName === "StrategyOrderCreated")[0]
        .args.orderId;

      // Verify order creation
      const order = await contract.getOrderDetails(orderId);
      expect(order.order.strategyType).to.equal(2); // GRID_TRADING
      expect(order.order.gridLevels).to.equal(gridLevels);

      // Mock swap data
      const swapData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "uint256"],
        [WETH, DAI, totalAmount / gridLevels, ethers.parseEther("400")] // Mock 1/5 WETH = 400 DAI
      );

      // Execute grid level
      await expect(
        contract.connect(executor).executeGridLevel(orderId, 0, swapData, ethers.parseEther("380"))
      )
        .to.emit(contract, "GridLevelExecuted")
        .withArgs(orderId, 0, ethers.parseEther("1"), totalAmount / gridLevels, true); // Mock price = 1 for simplicity

      // Verify grid level state
      const gridInfo = await contract.getGridTradingInfo(orderId);
      expect(gridInfo.levelsExecuted[0]).to.be.true;
      expect(gridInfo.levelsExecuted[1]).to.be.false;
    });
  });
   describe("Vesting Order", function () {
    it("should create and claim vested tokens", async function () {
      const totalAmount = ethers.parseEther("100");
      const vestingStart = await time.latest();
      const vestingDuration = 86400 * 30; // 30 days
      const cliffPeriod = 86400 * 7; // 7 days

      const tx = await contract.connect(user).createVestingOrder(
        DAI,
        user.address,
        totalAmount,
        vestingStart,
        vestingDuration,
        cliffPeriod
      );

      const receipt = await tx.wait();
      const orderId = receipt.logs
        .filter((log) => log.eventName === "StrategyOrderCreated")[0]
        .args.orderId;

      // Verify order creation
      const order = await contract.getOrderDetails(orderId);
      expect(order.order.strategyType).to.equal(4); // VESTING_PAYOUTS

      // Try to claim during cliff period (should fail)
      await expect(contract.connect(user).claimVestedTokens(orderId)).to.be.revertedWith(
        "No tokens to claim"
      );

      // Advance time past cliff period
      await time.increase(cliffPeriod + 1);

      // Claim vested tokens
      const balanceBefore = await takerAsset.balanceOf(user.address);
      await contract.connect(user).claimVestedTokens(orderId);
      const balanceAfter = await takerAsset.balanceOf(user.address);

      const vestingInfo = await contract.getVestingInfo(orderId);
      expect(balanceAfter - balanceBefore).to.equal(vestingInfo.claimableAmount);
    });
  });

  describe("Gas Station Order", function () {
    it("should create and fulfill a gas station order", async function () {
      const amountIn = ethers.parseEther("100");
      const gasNeeded = 100000; // 100k gas units
      const swapData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "uint256"],
        [DAI, ethers.constants.AddressZero, amountIn, ethers.parseEther("0.05")] // Mock 100 DAI = 0.05 ETH
      );

      const tx = await contract.connect(user).createGasStationOrder(
        DAI,
        amountIn,
        gasNeeded,
        swapData
      );

      const receipt = await tx.wait();
      const orderId = receipt.logs
        .filter((log) => log.eventName === "StrategyOrderCreated")[0]
        .args.orderId;

      // Fund contract with ETH for gas
      await deployer.sendTransaction({
        to: contract.getAddress(),
        value: ethers.parseEther("0.1"),
      });

      // Fulfill gas station order
      const userEthBalanceBefore = await ethers.provider.getBalance(user.address);
      await expect(contract.connect(executor).fulfillGasStation(orderId))
        .to.emit(contract, "GasStationFulfilled")
        .withArgs(orderId, user.address, gasNeeded, amountIn);

      const userEthBalanceAfter = await ethers.provider.getBalance(user.address);
      expect(userEthBalanceAfter - userEthBalanceBefore).to.be.closeTo(
        ethers.parseEther("0.05"),
        ethers.parseEther("0.01") // Allow some gas cost variance
      );
    });
  });
 
  describe("Conditional Order", function () {
    it("should create and execute a conditional order", async function () {
      const amount = ethers.parseEther("10");
      const deadline = (await time.latest()) + 86400;
      const conditions = {
        oracle: priceOracle,
        triggerPrice: ethers.parseEther("2000"), // Trigger when WETH/DAI = 2000
        triggerAbove: true,
        timeCondition: 0,
        dependentOrderId: ethers.constants.HashZero,
        chainlinkFeed: true,
      };

      const tx = await contract.connect(user).createConditionalOrder(
        WETH,
        DAI,
        amount,
        deadline,
        conditions
      );

      const receipt = await tx.wait();
      const orderId = receipt.logs
        .filter((log) => log.eventName === "StrategyOrderCreated")[0]
        .args.orderId;

      // Mock swap data
      const swapData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "uint256"],
        [WETH, DAI, amount, ethers.parseEther("2000")]
      );

      // Mock price oracle (override _getCurrentPrice to return 2000)
      await network.provider.send("hardhat_setCode", [
        contract.getAddress(),
        // Simplified override for _getCurrentPrice to return triggerPrice
        // In a real test, you'd mock the oracle properly
        "0x" // Placeholder: you'd need to inject a mock price
      ]);

      await expect(
        contract.connect(executor).executeConditionalOrder(orderId, swapData, ethers.parseEther("1900"))
      )
        .to.emit(contract, "ConditionalTriggerMet")
        .withArgs(orderId, conditions.triggerPrice, ethers.parseEther("2000"), true);
    });
  });
 describe("Order Management", function () {
    it("should allow pausing and resuming an order", async function () {
      const totalAmount = ethers.parseEther("10");
      const intervalAmount = ethers.parseEther("2");
      const intervalDuration = MIN_INTERVAL;
      const priceLimit = ethers.parseEther("1");
      const deadline = (await time.latest()) + 86400;
      const slippageTolerance = 500;

      const tx = await contract.connect(user).createTWAPOrder(
        WETH,
        DAI,
        totalAmount,
        intervalAmount,
        intervalDuration,
        priceLimit,
        deadline,
        slippageTolerance,
        "0x",
        "0x",
        "0x"
      );

      const receipt = await tx.wait();
      const orderId = receipt.logs
        .filter((log) => log.eventName === "StrategyOrderCreated")[0]
        .args.orderId;

      // Pause order
      await contract.connect(user).pauseOrder(orderId);
      let order = await contract.getOrderDetails(orderId);
      expect(order.order.status).to.equal(2); // PAUSED

      // Try to execute (should fail)
      const swapData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "uint256"],
        [WETH, DAI, intervalAmount, ethers.parseEther("2000")]
      );
      await expect(
        contract.connect(executor).executeTWAPOrder(orderId, swapData, ethers.parseEther("1900"))
      ).to.be.revertedWith("Order not active");

      // Resume order
      await contract.connect(user).resumeOrder(orderId);
      order = await contract.getOrderDetails(orderId);
      expect(order.order.status).to.equal(1); // ACTIVE
    });

    it("should allow canceling an order", async function () {
      const totalAmount = ethers.parseEther("10");
      const intervalAmount = ethers.parseEther("2");
      const intervalDuration = MIN_INTERVAL;
      const priceLimit = ethers.parseEther("1");
      const deadline = (await time.latest()) + 86400;
      const slippageTolerance = 500;

      const tx = await contract.connect(user).createTWAPOrder(
        WETH,
        DAI,
        totalAmount,
        intervalAmount,
        intervalDuration,
        priceLimit,
        deadline,
        slippageTolerance,
        "0x",
        "0x",
        "0x"
      );

      const receipt = await tx.wait();
      const orderId = receipt.logs
        .filter((log) => log.eventName === "StrategyOrderCreated")[0]
        .args.orderId;

      // Cancel order
      const balanceBefore = await takerAsset.balanceOf(user.address);
      await contract.connect(user).cancelOrder(orderId);
      const balanceAfter = await takerAsset.balanceOf(user.address);
      expect(balanceAfter - balanceBefore).to.equal(totalAmount);

      const order = await contract.getOrderDetails(orderId);
      expect(order.order.status).to.equal(4); // CANCELLED
      expect(order.order.remainingMakingAmount).to.equal(0);
    });
  });
   describe("1inch LOP Integration", function () {
    it("should return correct TWAP making and taking amounts", async function () {
      const totalAmount = ethers.parseEther("10");
      const intervalAmount = ethers.parseEther("2");
      const intervalDuration = MIN_INTERVAL;
      const priceLimit = ethers.parseEther("1");
      const deadline = (await time.latest()) + 86400;
      const slippageTolerance = 500;

      const tx = await contract.connect(user).createTWAPOrder(
        WETH,
        DAI,
        totalAmount,
        intervalAmount,
        intervalDuration,
        priceLimit,
        deadline,
        slippageTolerance,
        "0x",
        "0x",
        "0x"
      );

      const receipt = await tx.wait();
      const orderId = receipt.logs
        .filter((log) => log.eventName === "StrategyOrderCreated")[0]
        .args.orderId;

      // Check making amount before interval
      let makingAmount = await contract.getTWAPMakingAmount(orderId);
      expect(makingAmount).to.equal(0);

      // Advance time
      await time.increase(intervalDuration + 1);

      // Check making amount after interval
      makingAmount = await contract.getTWAPMakingAmount(orderId);
      expect(makingAmount).to.equal(intervalAmount);

      // Check taking amount (mock price = 1:1 for simplicity)
      const takingAmount = await contract.getTWAPTakingAmount(orderId);
      expect(takingAmount).to.equal((intervalAmount * (10000 - slippageTolerance)) / 10000);
    });
  });
});