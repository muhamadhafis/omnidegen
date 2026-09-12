// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPancakeRouter {
    function WETH() external pure returns (address);
    function swapExactETHForTokens(uint256 minOut, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory amounts);
}

interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
}

// Brankas kustodian MVP: user deposit BNB, backend (relayer) mengeksekusi hedge
// BNB -> stable via Pancake saat trigger. Dana TIDAK PERNAH bisa ke wallet luar
// kecuali: stable hasil hedge hanya bisa ditarik pemiliknya sendiri.
// ponytail: single relayer key, upgrade ke ERC-4337 Session Key + Bundler kalau mainnet.
contract OmniVault {
    address public immutable backend;
    IPancakeRouter public immutable router;
    address public immutable stable;

    mapping(address => uint256) public bnbBalance;
    mapping(address => uint256) public stableBalance;

    event Deposited(address indexed user, uint256 amount);
    event Hedged(address indexed user, uint256 bnbIn, uint256 stableOut);
    event Withdrawn(address indexed user, uint256 amount);

    error OnlyBackend();
    error Insufficient();
    error BadAmount();

    constructor(address _backend, address _router, address _stable) {
        backend = _backend;
        router = IPancakeRouter(_router);
        stable = _stable;
    }

    receive() external payable {}

    function deposit() external payable {
        if (msg.value == 0) revert BadAmount();
        bnbBalance[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // Guardrail: hanya backend; path hardcoded WBNB->stable; hasil dikredit ke user.
    // AI nakal / hacker tak bisa selipkan target / penerima lain: tak ada parameter itu.
    function executeHedge(address user, uint256 amount, uint256 minOut) external {
        if (msg.sender != backend) revert OnlyBackend();
        if (amount == 0 || bnbBalance[user] < amount) revert Insufficient();
        bnbBalance[user] -= amount;

        address[] memory path = new address[](2);
        path[0] = router.WETH();
        path[1] = stable;
        uint256[] memory outs =
            router.swapExactETHForTokens{value: amount}(minOut, path, address(this), block.timestamp);
        stableBalance[user] += outs[1];
        emit Hedged(user, amount, outs[1]);
    }

    function withdrawStable(uint256 amount) external {
        if (amount == 0 || stableBalance[msg.sender] < amount) revert Insufficient();
        stableBalance[msg.sender] -= amount;
        require(IERC20Like(stable).transfer(msg.sender, amount), "transfer fail");
        emit Withdrawn(msg.sender, amount);
    }
}
