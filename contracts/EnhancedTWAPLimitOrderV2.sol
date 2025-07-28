// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Enhanced TWAP Limit Order Protocol with 1inch LOP Extensions
 * @dev Advanced hackathon submission implementing custom extensions for 1inch Limit Order Protocol
 * @author Daniel KAMBALE - Hackathon Submission
 */

 /// @dev 1inch Limit Order Protocol interface for extensions
interface ILimitOrderProtocol {
    function fillOrder(
        bytes32 orderHash,
        uint256 makingAmount,
        uint256 takingAmount,
        bytes calldata makerAssetData,
        bytes calldata takerAssetData,
        bytes calldata getMakingAmountData,
        bytes calldata getTakingAmountData,
        bytes calldata predicate,
        bytes calldata makerPermit,
        bytes calldata preInteractionData,
        bytes calldata postInteractionData
    ) external;
}

contract EnhancedTWAPLimitOrderV2 is ReentrancyGuard, Ownable, EIP712 {
    using SafeERC20 for IERC20;
    using Math for uint256;

// =============================================================================
    // 1INCH LIMIT ORDER PROTOCOL INTEGRATION
    // =============================================================================

    /// @dev Enhanced order structure compatible with 1inch LOP extensions
    struct LimitOrderData {
        address salt;           // For unique order identification
        address makerAsset;     // Token to sell
        address takerAsset;     // Token to buy
        bytes makerAssetData;   // Maker asset suffix data
        bytes takerAssetData;   // Taker asset suffix data
        bytes getMakingAmountData; // Dynamic making amount calculation
        bytes getTakingAmountData; // Dynamic taking amount calculation
        bytes predicate;        // Conditional execution logic
        bytes permit;           // Gasless approvals
        bytes preInteraction;   // Pre-execution hooks
        bytes postInteraction;  // Post-execution hooks
    }

     // =============================================================================
    // CORE ENUMS & CONSTANTS
    // =============================================================================

    enum StrategyType { 
        TWAP,               // Time-Weighted Average Price
        DCA,                // Dollar Cost Averaging
        GRID_TRADING,       // Grid trading strategy
        STOP_LOSS_TRAILING, // Trailing stop-loss
        VESTING_PAYOUTS,    // Vesting with limit orders
        GAS_STATION,        // Gas station functionality
        REBALANCING,        // Portfolio rebalancing
        CONDITIONAL_ORDER   // Complex conditional orders
    }

    enum ExecutionStatus { 
        PENDING, ACTIVE, PAUSED, COMPLETED, CANCELLED, EXPIRED 
    }

     // Protocol constants optimized for 1inch integration
    uint256 public constant MIN_INTERVAL = 1 minutes;
    uint256 public constant MAX_INTERVAL = 365 days;
    uint256 public constant PRECISION = 1e18;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_SLIPPAGE = 1000; // 10%
    
    // 1inch specific constants
    address public constant ONEINCH_AGGREGATION_ROUTER = 0x111111125421cA6dc452d289314280a0f8842A65;
    address public constant ONEINCH_LIMIT_ORDER_PROTOCOL = 0x119c71D3BbAC22029622cbaEc24854d3D32D2828;
  // =============================================================================
    // ENHANCED ORDER STRUCTURE WITH 1INCH EXTENSIONS
    // =============================================================================

    /// @dev Main strategy order with 1inch LOP integration
    struct StrategyOrder {
        // Basic order info
        bytes32 orderId;
        address maker;
        address makerAsset;
        address takerAsset;
        
        // Amounts and execution
        uint256 totalMakingAmount;
        uint256 remainingMakingAmount;
        uint256 executedAmount;
        uint256 intervalAmount;
        uint256 intervalDuration;
        
        // Strategy parameters
        StrategyType strategyType;
        ExecutionStatus status;
        uint256 lastExecution;
        uint256 deadline;
        uint256 executionCount;
        
        // 1inch LOP extensions
        LimitOrderData lopData;
        
        // Advanced features
        uint256 priceLimit;
        uint256 slippageTolerance;
        bool mevProtected;
        bool gasOptimized;
        
        // Grid trading specific
        uint256 gridLevels;
        uint256 gridSpacing;
        uint256[] gridPrices;
        
        // Vesting specific
        uint256 vestingStart;
        uint256 vestingDuration;
        uint256 cliffPeriod;
        
        // Analytics
        uint256 averageExecutionPrice;
        uint256 totalGasUsed;
        int256 realizedPnL;
    }
    /// @dev Gas station order for gasless transactions
    struct GasStationOrder {
        address user;
        address tokenIn;
        uint256 amountIn;
        uint256 gasNeeded;
        uint256 gasPrice;
        bytes swapData;
        bool fulfilled;
    }

    /// @dev Conditional execution parameters
    struct ConditionalParams {
        address oracle;
        uint256 triggerPrice;
        bool triggerAbove;
        uint256 timeCondition;
        bytes32 dependentOrderId;
        bool chainlinkFeed;
    }

    // =============================================================================
    // STORAGE
    // =============================================================================

    mapping(bytes32 => StrategyOrder) public strategyOrders;
    mapping(address => bytes32[]) public userOrders;
    mapping(bytes32 => GasStationOrder) public gasStationOrders;
    mapping(bytes32 => ConditionalParams) public conditionalParams;
    mapping(bytes32 => uint256[]) public executionHistory;
    mapping(bytes32 => uint256[]) public priceHistory;
   
    // Grid trading state
    mapping(bytes32 => mapping(uint256 => bool)) public gridLevelExecuted;
    mapping(bytes32 => uint256) public currentGridLevel;
    
    // Vesting state
    mapping(bytes32 => uint256) public vestedAmount;
    mapping(bytes32 => uint256) public claimedAmount;
    
    // Protocol management
    mapping(address => bool) public authorizedExecutors;
    mapping(address => bool) public authorizedOracles;
    uint256 public protocolFee = 10; // 0.1%
    uint256 public executorReward = 5; // 0.05%
    
    // Oracle integration
    address public priceOracle;
    address public chainlinkRegistry;

    // =============================================================================
    // EVENTS
    // =============================================================================

    event StrategyOrderCreated(
        bytes32 indexed orderId,
        address indexed maker,
        StrategyType strategyType,
        address makerAsset,
        address takerAsset,
        uint256 totalAmount
    );

    
    event OrderExecuted(
        bytes32 indexed orderId,
        uint256 executionIndex,
        uint256 amountIn,
        uint256 amountOut,
        uint256 executionPrice,
        address executor
    );

    event GridLevelExecuted(
        bytes32 indexed orderId,
        uint256 gridLevel,
        uint256 price,
        uint256 amount,
        bool isBuy
    );

    event VestingClaimed(
        bytes32 indexed orderId,
        uint256 amount,
        uint256 totalClaimed,
        uint256 remaining
    );

     event GasStationFulfilled(
        bytes32 indexed orderId,
        address user,
        uint256 gasProvided,
        uint256 tokensCost
    );

    event ConditionalTriggerMet(
        bytes32 indexed orderId,
        uint256 triggerPrice,
        uint256 currentPrice,
        bool triggerAbove
    );

   
    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    constructor(
        address _priceOracle,
        address _chainlinkRegistry
    ) Ownable(msg.sender) EIP712("EnhancedTWAPProtocol", "1") {
        priceOracle = _priceOracle;
        chainlinkRegistry = _chainlinkRegistry;
        authorizedExecutors[msg.sender] = true;
    }
 
    // =============================================================================
    // MODIFIERS
    // =============================================================================

    modifier onlyAuthorizedExecutor() {
        require(authorizedExecutors[msg.sender] || msg.sender == owner(), "Unauthorized executor");
        _;
    }

    modifier validOrder(bytes32 orderId) {
        StrategyOrder storage order = strategyOrders[orderId];
        require(order.status == ExecutionStatus.ACTIVE, "Order not active");
        require(order.deadline > block.timestamp, "Order expired");
        require(order.remainingMakingAmount > 0, "Order completed");
        _;
    }

      // =============================================================================
    // CORE STRATEGY CREATION FUNCTIONS
    // =============================================================================

    /**
     * @dev Create a TWAP order with custom intervals and price limits
     */
    function createTWAPOrder(
        address makerAsset,
        address takerAsset,
        uint256 totalAmount,
        uint256 intervalAmount,
        uint256 intervalDuration,
        uint256 priceLimit,
        uint256 deadline,
        uint256 slippageTolerance,
        bytes calldata predicateData,
        bytes calldata preInteractionData,
        bytes calldata postInteractionData
    ) external nonReentrant returns (bytes32 orderId) {
        require(totalAmount > 0, "Invalid total amount");
        require(intervalAmount > 0 && intervalAmount <= totalAmount, "Invalid interval amount");
        require(intervalDuration >= MIN_INTERVAL, "Interval too short");
        require(deadline > block.timestamp, "Invalid deadline");
        require(slippageTolerance <= MAX_SLIPPAGE, "Slippage too high");

        // Transfer tokens to contract
        IERC20(makerAsset).safeTransferFrom(msg.sender, address(this), totalAmount);

        // Generate unique order ID
        orderId = keccak256(abi.encodePacked(
            msg.sender,
            makerAsset,
            takerAsset,
            totalAmount,
            block.timestamp,
            block.prevrandao
        ));

        // Create 1inch LOP extension data
        LimitOrderData memory lopData = LimitOrderData({
            salt: address(uint160(uint256(orderId))),
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            makerAssetData: "",
            takerAssetData: "",
            getMakingAmountData: abi.encodeWithSelector(
                this.getTWAPMakingAmount.selector,
                orderId
            ),
            getTakingAmountData: abi.encodeWithSelector(
                this.getTWAPTakingAmount.selector,
                orderId
            ),
            predicate: predicateData,
            permit: "",
            preInteraction: preInteractionData,
            postInteraction: postInteractionData
        });

        
        // Create strategy order
        StrategyOrder storage order = strategyOrders[orderId];
        order.orderId = orderId;
        order.maker = msg.sender;
        order.makerAsset = makerAsset;
        order.takerAsset = takerAsset;
        order.totalMakingAmount = totalAmount;
        order.remainingMakingAmount = totalAmount;
        order.intervalAmount = intervalAmount;
        order.intervalDuration = intervalDuration;
        order.strategyType = StrategyType.TWAP;
        order.status = ExecutionStatus.ACTIVE;
        order.deadline = deadline;
        order.lopData = lopData;
        order.priceLimit = priceLimit;
        order.slippageTolerance = slippageTolerance;
        order.mevProtected = true;
        order.gasOptimized = true;

        userOrders[msg.sender].push(orderId);

        emit StrategyOrderCreated(
            orderId, 
            msg.sender, 
            StrategyType.TWAP, 
            makerAsset, 
            takerAsset, 
            totalAmount
        );

        return orderId;
    }

    
    /**
     * @dev Create a grid trading strategy with multiple price levels
     */
    function createGridTradingOrder(
        address baseAsset,
        address quoteAsset,
        uint256 totalAmount,
        uint256 gridLevels,
        uint256 lowerPrice,
        uint256 upperPrice,
        uint256 deadline
    ) external nonReentrant returns (bytes32 orderId) {
        require(totalAmount > 0, "Invalid amount");
        require(gridLevels >= 2 && gridLevels <= 20, "Invalid grid levels");
        require(lowerPrice < upperPrice, "Invalid price range");
        require(deadline > block.timestamp, "Invalid deadline");

        IERC20(baseAsset).safeTransferFrom(msg.sender, address(this), totalAmount);

        orderId = keccak256(abi.encodePacked(
            msg.sender,
            baseAsset,
            quoteAsset,
            totalAmount,
            gridLevels,
            block.timestamp
        ));

        

        // Calculate grid prices
        uint256[] memory gridPrices = new uint256[](gridLevels);
        uint256 priceStep = (upperPrice - lowerPrice) / (gridLevels - 1);
        
        for (uint256 i = 0; i < gridLevels; i++) {
            gridPrices[i] = lowerPrice + (i * priceStep);
        }

        StrategyOrder storage order = strategyOrders[orderId];
        order.orderId = orderId;
        order.maker = msg.sender;
        order.makerAsset = baseAsset;
        order.takerAsset = quoteAsset;
        order.totalMakingAmount = totalAmount;
        order.remainingMakingAmount = totalAmount;
        order.intervalAmount = totalAmount / gridLevels;
        order.strategyType = StrategyType.GRID_TRADING;
        order.status = ExecutionStatus.ACTIVE;
        order.deadline = deadline;
        order.gridLevels = gridLevels;
        order.gridSpacing = priceStep;
        order.gridPrices = gridPrices;

        userOrders[msg.sender].push(orderId);

        emit StrategyOrderCreated(
            orderId,
            msg.sender,
            StrategyType.GRID_TRADING,
            baseAsset,
            quoteAsset,
            totalAmount
        );

        return orderId;
    }

     /**
     * @dev Create a vesting payout order with cliff and linear vesting
     */
    function createVestingOrder(
        address asset,
        address beneficiary,
        uint256 totalAmount,
        uint256 vestingStart,
        uint256 vestingDuration,
        uint256 cliffPeriod
    ) external nonReentrant returns (bytes32 orderId) {
        require(totalAmount > 0, "Invalid amount");
        require(vestingStart >= block.timestamp, "Invalid start time");
        require(vestingDuration > 0, "Invalid duration");
        require(cliffPeriod <= vestingDuration, "Cliff too long");

        IERC20(asset).safeTransferFrom(msg.sender, address(this), totalAmount);

        orderId = keccak256(abi.encodePacked(
            msg.sender,
            beneficiary,
            asset,
            totalAmount,
            vestingStart,
            block.timestamp
        ));

        StrategyOrder storage order = strategyOrders[orderId];
        order.orderId = orderId;
        order.maker = msg.sender;
        order.makerAsset = asset;
        order.takerAsset = asset; // Same asset for vesting
        order.totalMakingAmount = totalAmount;
        order.remainingMakingAmount = totalAmount;
        order.strategyType = StrategyType.VESTING_PAYOUTS;
        order.status = ExecutionStatus.ACTIVE;
        order.deadline = vestingStart + vestingDuration;
        order.vestingStart = vestingStart;
        order.vestingDuration = vestingDuration;
        order.cliffPeriod = cliffPeriod;

        userOrders[beneficiary].push(orderId);

        emit StrategyOrderCreated(
            orderId,
            msg.sender,
            StrategyType.VESTING_PAYOUTS,
            asset,
            asset,
            totalAmount
        );

        return orderId;
    }

       /**
     * @dev Create a gas station order for gasless transactions
     */
    function createGasStationOrder(
        address tokenIn,
        uint256 amountIn,
        uint256 gasNeeded,
        bytes calldata swapData
    ) external nonReentrant returns (bytes32 orderId) {
        require(amountIn > 0, "Invalid amount");
        require(gasNeeded > 0, "Invalid gas amount");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        orderId = keccak256(abi.encodePacked(
            msg.sender,
            tokenIn,
            amountIn,
            gasNeeded,
            block.timestamp
        ));

        gasStationOrders[orderId] = GasStationOrder({
            user: msg.sender,
            tokenIn: tokenIn,
            amountIn: amountIn,
            gasNeeded: gasNeeded,
            gasPrice: tx.gasprice,
            swapData: swapData,
            fulfilled: false
        });

        emit StrategyOrderCreated(
            orderId,
            msg.sender,
            StrategyType.GAS_STATION,
            tokenIn,
            address(0), // ETH for gas
            amountIn
        );

        return orderId;
    }

    // =============================================================================
    // EXECUTION FUNCTIONS
    // =============================================================================

    /**
     * @dev Execute TWAP order interval
     */
    function executeTWAPOrder(
        bytes32 orderId,
        bytes calldata swapData,
        uint256 minAmountOut
    ) external onlyAuthorizedExecutor validOrder(orderId) nonReentrant {
        StrategyOrder storage order = strategyOrders[orderId];
        require(order.strategyType == StrategyType.TWAP, "Not TWAP order");
        require(
            block.timestamp >= order.lastExecution + order.intervalDuration,
            "Too early for execution"
        );

        uint256 amountToExecute = Math.min(order.intervalAmount, order.remainingMakingAmount);
        
        // Execute 1inch swap
        uint256 amountOut = _execute1inchSwap(
            order.makerAsset,
            order.takerAsset,
            amountToExecute,
            swapData,
            minAmountOut
        );

        // Update order state
        order.remainingMakingAmount -= amountToExecute;
        order.executedAmount += amountToExecute;
        order.lastExecution = block.timestamp;
        order.executionCount++;

        // Calculate execution price and update analytics
        uint256 executionPrice = (amountOut * PRECISION) / amountToExecute;
        order.averageExecutionPrice = (
            (order.averageExecutionPrice * (order.executionCount - 1)) + executionPrice
        ) / order.executionCount;

        // Transfer output tokens to maker
        IERC20(order.takerAsset).safeTransfer(order.maker, amountOut);

        // Update execution history
        executionHistory[orderId].push(block.timestamp);
        priceHistory[orderId].push(executionPrice);

        // Check if order is completed
        if (order.remainingMakingAmount == 0) {
            order.status = ExecutionStatus.COMPLETED;
        }

        emit OrderExecuted(
            orderId,
            order.executionCount,
            amountToExecute,
            amountOut,
            executionPrice,
            msg.sender
        );
    }

    /**
     * @dev Execute grid trading level
     */
    function executeGridLevel(
        bytes32 orderId,
        uint256 gridLevel,
        bytes calldata swapData,
        uint256 minAmountOut
    ) external onlyAuthorizedExecutor validOrder(orderId) nonReentrant {
        StrategyOrder storage order = strategyOrders[orderId];
        require(order.strategyType == StrategyType.GRID_TRADING, "Not grid order");
        require(gridLevel < order.gridLevels, "Invalid grid level");
        require(!gridLevelExecuted[orderId][gridLevel], "Level already executed");

        uint256 currentPrice = _getCurrentPrice(order.makerAsset, order.takerAsset);
        uint256 targetPrice = order.gridPrices[gridLevel];
        
        // Check if price condition is met (simplified logic)
        require(
            (currentPrice >= targetPrice * 99 / 100) && 
            (currentPrice <= targetPrice * 101 / 100),
            "Price condition not met"
        );

        uint256 amountToExecute = order.intervalAmount;
        
        // Execute swap
        uint256 amountOut = _execute1inchSwap(
            order.makerAsset,
            order.takerAsset,
            amountToExecute,
            swapData,
            minAmountOut
        );

        // Update state
        order.remainingMakingAmount -= amountToExecute;
        order.executedAmount += amountToExecute;
        order.executionCount++;
        gridLevelExecuted[orderId][gridLevel] = true;

        IERC20(order.takerAsset).safeTransfer(order.maker, amountOut);

        emit GridLevelExecuted(orderId, gridLevel, currentPrice, amountToExecute, true);
    }


    /**
     * @dev Claim vested tokens
     */
     
    function claimVestedTokens(bytes32 orderId) external nonReentrant {
        StrategyOrder storage order = strategyOrders[orderId];
        require(order.strategyType == StrategyType.VESTING_PAYOUTS, "Not vesting order");
        require(block.timestamp >= order.vestingStart, "Vesting not started");
        
        uint256 vestedNow = _calculateVestedAmount(orderId);
        uint256 claimableAmount = vestedNow - claimedAmount[orderId];
        
        require(claimableAmount > 0, "No tokens to claim");

        claimedAmount[orderId] += claimableAmount;
        order.executedAmount += claimableAmount;
        order.remainingMakingAmount -= claimableAmount;

        IERC20(order.makerAsset).safeTransfer(msg.sender, claimableAmount);

        emit VestingClaimed(orderId, claimableAmount, claimedAmount[orderId], order.remainingMakingAmount);
    }



}