// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Oracle manual untuk demo terkontrol: owner/demo memanggil setPrice saat pitching.
// ponytail: ganti Chainlink/Pyth di mainnet, MockOracle hanya untuk testnet demo.
contract MockOracle {
    uint256 public price; // USD 8 desimal, cth 500e8 = $500
    event PriceSet(uint256 price);

    constructor(uint256 _init) {
        price = _init;
    }

    function setPrice(uint256 _price) external {
        price = _price;
        emit PriceSet(_price);
    }
}
