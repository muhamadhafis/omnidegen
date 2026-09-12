// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";
import "../src/MockOracle.sol";
import "../src/OmniVault.sol";

interface IRouterSeed {
    function addLiquidityETH(address token, uint256 amtToken, uint256 amtTokenMin, uint256 amtETHMin, address to, uint256 deadline)
        external
        payable
        returns (uint256, uint256, uint256);
}

// Deploy: MockUSDC -> MockOracle($500) -> OmniVault -> seed likuiditas WBNB/mUSDC.
// Usage: forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $BACKEND_PRIVATE_KEY --broadcast --verify
contract Deploy is Script {
    address constant ROUTER = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;

    function run() external {
        uint256 key = vm.envUint("BACKEND_PRIVATE_KEY");
        address backend = vm.addr(key);
        vm.startBroadcast(key);

        MockUSDC usdc = new MockUSDC();
        MockOracle oracle = new MockOracle(500e8);
        OmniVault vault = new OmniVault(backend, ROUTER, address(usdc));

        // seed likuiditas 0.005 BNB : 2.5 mUSDC (hemat faucet, rasio 1:500)
        usdc.mint(backend, 2.5 ether);
        usdc.approve(ROUTER, 2.5 ether);
        IRouterSeed(ROUTER).addLiquidityETH{value: 0.005 ether}(address(usdc), 2.5 ether, 0, 0, backend, block.timestamp);

        vm.stopBroadcast();
        console.log("MockUSDC:", address(usdc));
        console.log("MockOracle:", address(oracle));
        console.log("OmniVault:", address(vault));
    }
}
