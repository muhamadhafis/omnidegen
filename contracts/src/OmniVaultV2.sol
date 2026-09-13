// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPancakeRouter {
    function swapExactTokensForTokens(uint256 amountIn, uint256 minOut, address[] calldata path, address to, uint256 deadline)
        external
        returns (uint256[] memory amounts);
}

interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address a) external view returns (uint256);
}

// Vault non-custodial: dana tetap di dompet user. Vault hanya boleh menarik
// maksimal sebesar allowance yang user kasih (bisa dicabut kapan saja),
// swap WBNB->stable, dan hasilnya dikirim LANGSUNG ke user.
// Tak ada deposit, tak ada saldo mengendap, tak ada parameter penerima.
contract OmniVaultV2 {
    address public immutable backend;
    IPancakeRouter public immutable router;
    address public immutable wbnb;
    address public immutable stable;

    event Hedged(address indexed user, uint256 inAmt, uint256 outAmt);

    error OnlyBackend();
    error OverCap();
    error Insufficient();
    error BadAmount();

    constructor(address _backend, address _router, address _wbnb, address _stable) {
        backend = _backend;
        router = IPancakeRouter(_router);
        wbnb = _wbnb;
        stable = _stable;
        IERC20Like(_wbnb).approve(_router, type(uint256).max); // izin sekali ke router
    }

    function executeHedgePull(address user, uint256 amount, uint256 minOut) external {
        if (msg.sender != backend) revert OnlyBackend();
        if (amount == 0) revert BadAmount();
        if (IERC20Like(wbnb).allowance(user, address(this)) < amount) revert OverCap();
        if (IERC20Like(wbnb).balanceOf(user) < amount) revert Insufficient();

        require(IERC20Like(wbnb).transferFrom(user, address(this), amount), "pull fail");

        address[] memory path = new address[](2);
        path[0] = wbnb;
        path[1] = stable;
        uint256[] memory outs =
            router.swapExactTokensForTokens(amount, minOut, path, address(this), block.timestamp + 15 minutes);

        require(IERC20Like(stable).transfer(user, outs[1]), "payout fail");
        emit Hedged(user, amount, outs[1]);
    }
}
