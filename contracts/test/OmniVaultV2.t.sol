// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/OmniVaultV2.sol";
import "../src/MockUSDC.sol";

// Router bohongan 1:500 untuk unit test (tanpa fork).
contract MockRouter {
    address public w;
    address public s;

    constructor(address _w, address _s) {
        w = _w;
        s = _s;
    }

    function WETH() external view returns (address) {
        return w;
    }

    function swapExactTokensForTokens(uint256 amountIn, uint256, address[] calldata, address to, uint256)
        external
        returns (uint256[] memory outs)
    {
        MockUSDC(w).transferFrom(msg.sender, address(this), amountIn); // tarik seperti router asli
        MockUSDC(s).mint(to, amountIn * 500);
        outs = new uint256[](2);
        outs[0] = amountIn;
        outs[1] = amountIn * 500;
    }
}

contract OmniVaultV2UnitTest is Test {
    OmniVaultV2 vault;
    MockUSDC wbnb;
    MockUSDC usdc;
    address backend = address(0xBEEF);
    address user = makeAddr("user");

    function setUp() public {
        wbnb = new MockUSDC();
        usdc = new MockUSDC();
        MockRouter router = new MockRouter(address(wbnb), address(usdc));
        vault = new OmniVaultV2(backend, address(router), address(wbnb), address(usdc));
        wbnb.mint(user, 1 ether);
    }

    function testNonBackendReverts() public {
        vm.prank(user);
        vm.expectRevert(OmniVaultV2.OnlyBackend.selector);
        vault.executeHedgePull(user, 0.1 ether, 0);
    }

    function testNoAllowanceReverts() public {
        vm.prank(backend);
        vm.expectRevert(OmniVaultV2.OverCap.selector);
        vault.executeHedgePull(user, 0.1 ether, 0);
    }

    function testOverCapReverts() public {
        vm.prank(user);
        wbnb.approve(address(vault), 0.05 ether);
        vm.prank(backend);
        vm.expectRevert(OmniVaultV2.OverCap.selector);
        vault.executeHedgePull(user, 0.1 ether, 0);
    }

    function testNoBalanceReverts() public {
        address poor = makeAddr("poor");
        vm.prank(poor);
        wbnb.approve(address(vault), 1 ether);
        vm.prank(backend);
        vm.expectRevert(OmniVaultV2.Insufficient.selector);
        vault.executeHedgePull(poor, 0.1 ether, 0);
    }

    function testPullSuccessPaysUserDirectly() public {
        vm.prank(user);
        wbnb.approve(address(vault), 0.5 ether);
        vm.prank(backend);
        vault.executeHedgePull(user, 0.5 ether, 0);
        assertEq(usdc.balanceOf(user), 250 ether); // 0.5 * 500 mock rate
        assertEq(wbnb.balanceOf(address(vault)), 0); // tak ada mengendap
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    function testRevokeBlocksPull() public {
        vm.prank(user);
        wbnb.approve(address(vault), 0.5 ether);
        vm.prank(user);
        wbnb.approve(address(vault), 0); // cabut izin
        vm.prank(backend);
        vm.expectRevert(OmniVaultV2.OverCap.selector);
        vault.executeHedgePull(user, 0.1 ether, 0);
    }
}
