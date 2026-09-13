// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/OmniVaultV2.sol";

// Deploy V2 saja (pool + mUSDC V1 dipakai ulang).
// Usage: forge script script/DeployV2.s.sol --rpc-url $RPC_URL --private-key $BACKEND_PRIVATE_KEY --broadcast --verify ...
contract DeployV2 is Script {
    address constant ROUTER = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;
    address constant WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
    address constant MUSDC = 0x5930d789bE286F3645BD6678fB8eD1c786c2CE36;

    function run() external {
        uint256 key = vm.envUint("BACKEND_PRIVATE_KEY");
        address backend = vm.addr(key);
        vm.startBroadcast(key);
        OmniVaultV2 vault = new OmniVaultV2(backend, ROUTER, WBNB, MUSDC);
        vm.stopBroadcast();
        console.log("OmniVaultV2:", address(vault));
    }
}
