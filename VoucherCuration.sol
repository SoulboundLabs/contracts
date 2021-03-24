pragma solidity ^0.8.0;

import "./VoucherOracle.sol";


// holds ETH deposited by Badgeth Governance contract
// ETH is rewarded to incentivize accounts to call storeBadgeClaims
// todo: whitelist our secure Ethereum accounts, and the claim mining contract
contract VoucherCuration {
    address public voucherOracleAdresss;
    address public whitelistedValidator = 0xfdD336b0d1f58eb4cBc714E10171291d852a9E33;

    constructor(address _voucherOracleAdresss) {
        voucherOracleAdresss = _voucherOracleAdresss;
    }

     function requireValidAddress() private view {
        require(whitelistedValidator == msg.sender, "not whitelisted for rewards");
    }

    function storeBadgeClaims(address[] memory claimerAddresses, address badgeAddress) public {
        requireValidAddress();

        VoucherOracle voucherOracle = VoucherOracle(voucherOracleAdresss);
        voucherOracle.storeBadgeClaims(claimerAddresses, badgeAddress);
    }

}
