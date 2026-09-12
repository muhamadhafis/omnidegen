// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/OmniVault.sol";
import "../src/MockUSDC.sol";
import "../src/MockOracle.sol";

contract OmniVaultUnitTest is Test {
    OmniVault vault;
    MockUSDC usdc;
    address backend = address(0xBEEF);
    address user = makeAddr("user");

    function setUp() public {
        usdc = new MockUSDC();
        vault = new OmniVault(backend, address(0xD99D1c33F9fC3444f8101754aBC46c52416550D1), address(usdc));
    }

    function testDepositCredits() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        vault.deposit{value: 0.5 ether}();
        assertEq(vault.bnbBalance(user), 0.5 ether);
    }

    function testDepositZeroReverts() public {
        vm.prank(user);
        vm.expectRevert(OmniVault.BadAmount.selector);
        vault.deposit();
    }

    function testHedgeNonBackendReverts() public {
        vm.prank(user);
        vm.expectRevert(OmniVault.OnlyBackend.selector);
        vault.executeHedge(user, 1 ether, 0);
    }

    function testHedgeInsufficientReverts() public {
        vm.prank(backend);
        vm.expectRevert(OmniVault.Insufficient.selector);
        vault.executeHedge(user, 1 ether, 0);
    }

    function testWithdrawEmptyReverts() public {
        vm.prank(user);
        vm.expectRevert(OmniVault.Insufficient.selector);
        vault.withdrawStable(1 ether);
    }

    function testOracleSetPrice() public {
        MockOracle o = new MockOracle(500e8);
        assertEq(o.price(), 500e8);
        o.setPrice(440e8);
        assertEq(o.price(), 440e8);
    }
}
