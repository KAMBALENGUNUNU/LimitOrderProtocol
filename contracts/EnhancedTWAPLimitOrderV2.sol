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
