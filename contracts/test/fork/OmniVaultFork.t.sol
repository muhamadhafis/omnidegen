// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/OmniVault.sol";
import "../../src/MockUSDC.sol";

interface IRouterLike {
    function addLiquidityETH(address token, uint256 amtToken, uint256 amtTokenMin, uint256 amtETHMin, address to, uint256 deadline)
        external
        payable
        returns (uint256, uint256, uint256);
}

// Full flow lawan router Pancake asli di fork BSC testnet:
// deposit -> executeHedge (swap BNB->mUSDC beneran) -> withdrawStable.
contract OmniVaultForkTest is Test {
    address constant ROUTER = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;
    OmniVault vault;
    MockUSDC usdc;
    address backend = address(0xBEEF);
    address user = makeAddr("user");

    function setUp() public {
        vm.createSelectFork(vm.envString("RPC_URL"));
        usdc = new MockUSDC();
        vault = new OmniVault(backend, ROUTER, address(usdc));
        // seeding likuiditas WBNB/mUSDC 1:500 agar swap testnet jalan
        vm.deal(address(this), 20 ether);
        usdc.mint(address(this), 5000 ether);
        usdc.approve(ROUTER, 5000 ether);
        IRouterLike(ROUTER).addLiquidityETH{value: 10 ether}(address(usdc), 5000 ether, 0, 0, address(this), block.timestamp);
    }

    function testFullHedgeFlow() public {
        vm.deal(user, 2 ether);
        vm.prank(user);
        vault.deposit{value: 1 ether}();

        vm.prank(backend);
        vault.executeHedge(user, 1 ether, 0);
        assertEq(vault.bnbBalance(user), 0);
        uint256 got = vault.stableBalance(user);
        assertGt(got, 0);

        vm.prank(user);
        vault.withdrawStable(got);
        assertEq(usdc.balanceOf(user), got);
    }
}
