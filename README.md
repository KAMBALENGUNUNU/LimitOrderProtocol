# Enhanced TWAP Limit Order Protocol with 1inch LOP Extensions

![Project Banner](public/The%20Future%20of%20On-Chain%20Trading.png?text=Enhanced+TWAP+Limit+Order+Protocol) 

Welcome to **Enhanced TWAP Limit Order Protocol**, a cutting-edge submission for the 1inch Limit Order Protocol Hackathon. Built on a **forked Ethereum mainnet**, this project pushes the boundaries of decentralized trading by introducing advanced strategies and custom extensions to the 1inch Limit Order Protocol (LOP). Our solution delivers a robust, secure, and highly extensible smart contract framework that empowers users with sophisticated trading strategies like TWAP, grid trading, vesting payouts, gasless transactions, and conditional orders—all seamlessly integrated with 1inch's powerful infrastructure.

This project reflects months of dedicated development, with a consistent commit history showcasing iterative improvements, rigorous testing, and a commitment to excellence. Our goal? To impress the judges with a professional, feature-rich protocol that redefines onchain trading.

---
## 🌟 Project Overview

The **Enhanced TWAP Limit Order Protocol V2** is a versatile, onchain orderbook extension for the 1inch LOP, designed to provide advanced trading strategies while maintaining gas efficiency, security, and compatibility with 1inch's aggregation router and limit order protocol. Key features include:

- **Time-Weighted Average Price (TWAP) Orders**: Execute trades over time to minimize market impact, with customizable intervals and price limits.
- **Grid Trading**: Automated buy/sell orders across multiple price levels for market-making and range-bound strategies.
- **Vesting Payouts**: Linear vesting with cliff periods for token distribution, ideal for DAOs and token launches.
- **Gas Station**: Gasless transaction support, enabling users to swap tokens for ETH to cover gas costs.
- **Conditional Orders**: Trigger trades based on oracle price feeds, time conditions, or dependent order completion.
- **Trailing Stop-Loss**: Protect profits with dynamic stop-loss orders that trail market prices.
- **Batch Execution**: Process multiple orders in a single transaction for gas efficiency.
- **Analytics & Reporting**: Track order performance with detailed metrics like average execution price and realized PnL.

Our smart contract is deployed on a **forked Ethereum mainnet**, leveraging the 1inch Aggregation Router (`0x111111125421cA6dc452d289314280a0f8842A65`) and Limit Order Protocol (`0x119c71D3BbAC22029622cbaEc24854d3D32D2828`) for seamless integration.

---

## 🚀 Key Features

### 1. TWAP Orders
- **Purpose**: Minimize market impact by executing trades in smaller chunks over time.
- **Features**:
  - Configurable intervals (1 minute to 365 days).
  - Slippage protection and price limits.
  - Integration with 1inch LOP for dynamic amount calculations.
  - MEV protection and gas optimization.

### 2. Grid Trading
- **Purpose**: Enable automated trading within a price range, ideal for market-making or volatile markets.
- **Features**:
  - Multiple price levels (2–20 grids).
  - Dynamic execution based on current market prices.
  - Detailed tracking of executed grid levels.

### 3. Vesting Payouts
- **Purpose**: Support token vesting for projects, DAOs, or team allocations.
- **Features**:
  - Linear vesting with customizable cliff periods.
  - Secure token claims with precise calculations.
  - Transparent vesting status tracking.

### 4. Gas Station
- **Purpose**: Facilitate gasless transactions by swapping tokens for ETH to cover gas costs.
- **Features**:
  - Seamless integration with 1inch swaps.
  - Automated gas cost calculations and ETH transfers.
  - Protection against overpayment.

### 5. Conditional Orders
- **Purpose**: Execute trades based on external conditions (e.g., price triggers, time, or other orders).
- **Features**:
  - Oracle integration for price-based triggers.
  - Support for Chainlink feeds and custom oracles.
  - Dependency on other order completions.

### 6. Trailing Stop-Loss
- **Purpose**: Protect profits by automatically adjusting stop-loss levels as prices move.
- **Features**:
  - Configurable trailing percentage (up to 50%).
  - Secure execution with 1inch swap integration.

### 7. Advanced Analytics
- **Purpose**: Provide transparency into order performance.
- **Features**:
  - Track execution history, average prices, and gas usage.
  - Calculate realized PnL and execution efficiency.
  - Retrieve detailed order and grid trading status.

---

## 🛠 Technical Details

### Smart Contract Overview
- **Language**: Solidity ^0.8.20
- **Dependencies**:
  - OpenZeppelin: `Ownable`, `SafeERC20`, `ReentrancyGuard`, `EIP712`
  - 1inch Limit Order Protocol Interface
- **Network**: Deployed on a forked Ethereum mainnet for testing and demo purposes.
- **Key Contracts**:
  - `EnhancedTWAPLimitOrderV2.sol`: Core contract implementing all strategies and 1inch LOP extensions.

### Architecture Highlights
- **Modular Design**: Separate structs for `StrategyOrder`, `GasStationOrder`, and `ConditionalParams` ensure extensibility.
- **1inch Integration**: Leverages `ILimitOrderProtocol` for dynamic amount calculations and swap execution via the 1inch Aggregation Router.
- **Security Features**:
  - Reentrancy protection with `ReentrancyGuard`.
  - Safe token handling with `SafeERC20`.
  - EIP-712 for gasless approvals and order signing.
  - Authorized executors for controlled order execution.
- **Gas Optimization**:
  - Batch execution for multiple orders.
  - Optimized storage with mappings and arrays.
  - Gas station functionality to reduce user costs.

### Strategy Types
The contract supports multiple strategy types via the `StrategyType` enum:
1. `TWAP`
2. `DCA` (placeholder for future implementation)
3. `GRID_TRADING`
4. `STOP_LOSS_TRAILING`
5. `VESTING_PAYOUTS`
6. `GAS_STATION`
7. `REBALANCING` (placeholder for future implementation)
8. `CONDITIONAL_ORDER`

### Testing
- **Framework**: Hardhat with Mocha/Chai.
- **Test Coverage**:
  - TWAP order creation and execution.
  - Grid trading level execution.
  - Vesting token claims with cliff periods.
  - Gas station order fulfillment.
  - Conditional order triggers.
  - Order management (pause, resume, cancel).
  - 1inch LOP integration for dynamic amounts.
- **Environment**: Tests run on a forked Ethereum mainnet, using real mainnet token addresses (e.g., WETH, DAI) and impersonated whale accounts for realistic scenarios.

---