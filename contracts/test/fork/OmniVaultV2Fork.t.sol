// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/OmniVaultV2.sol";
import "../../src/MockUSDC.sol";

interface IWBNB {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}

// Full pull-flow lawan router Pancake asli di fork BSC testnet:
// wrap -> approve -> executeHedgePull -> user terima mUSDC langsung.
contract OmniVaultV2ForkTest is Test {
    address constant ROUTER = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;
    address constant WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
    address constant MUSDC = 0x5930d789bE286F3645BD6678fB8eD1c786c2CE36; // sudah punya pool WBNB/mUSDC
    OmniVaultV2 vault;
    MockUSDC usdc = MockUSDC(MUSDC);
    address backend = address(0xBEEF);
    address user = makeAddr("user");

    function setUp() public {
        vm.createSelectFork(vm.envString("RPC_URL"));
        vault = new OmniVaultV2(backend, ROUTER, WBNB, MUSDC);
    }

    function testFullPullFlow() public {
        vm.deal(user, 1 ether);
        vm.startPrank(user);
        IWBNB(WBNB).deposit{value: 0.01 ether}();
        IWBNB(WBNB).approve(address(vault), 0.01 ether);
        vm.stopPrank();

        vm.prank(backend);
        vault.executeHedgePull(user, 0.01 ether, 0);

        uint256 got = usdc.balanceOf(user);
        assertGt(got, 0);
        assertEq(IWBNB(WBNB).balanceOf(address(vault)), 0);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }
}
