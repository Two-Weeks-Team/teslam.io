// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * The same withdrawal architecture as scripts/chain/stellar-flow.mjs, in the
 * form an EVM chain requires: two contracts instead of four protocol calls.
 *
 * Written out rather than pulled from a library on purpose. The point of this
 * spike is to see what each chain actually asks you to own, and "we imported
 * OpenZeppelin" hides exactly the thing being measured.
 */

/**
 * DRV, with no way to make more of it.
 *
 * The site tells readers the supply is fixed and that nobody will print more.
 * On Stellar that becomes a fact by locking the issuing account. Here it
 * becomes a fact by there being no `mint` — the entire supply is created in
 * the constructor and the contract has no owner, no minter role and no
 * upgrade path. Nothing to trust, because there is nothing that could change
 * its mind.
 */
contract Drv {
    string public constant name = "teslam.io DRV";
    string public constant symbol = "DRV";
    uint8 public constant decimals = 7; // matches the Stellar asset

    uint256 public immutable totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(uint256 supply, address holder) {
        totalSupply = supply;
        balanceOf[holder] = supply;
        emit Transfer(address(0), holder, supply);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _move(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "allowance");
            allowance[from][msg.sender] = allowed - value;
        }
        _move(from, to, value);
        return true;
    }

    function _move(address from, address to, uint256 value) private {
        require(to != address(0), "to zero");
        uint256 held = balanceOf[from];
        require(held >= value, "balance");
        unchecked {
            balanceOf[from] = held - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }
}

/**
 * The withdrawal.
 *
 * The operator publishes one 32-byte root per settlement and the contract
 * holds the DRV until somebody proves membership. Two properties matter and
 * both come from what is *absent*:
 *
 *   There is no function that returns tokens to the operator. Once the DRV is
 *   in here it can only leave to an address the root committed to. That is
 *   what makes this non-custodial rather than a promise not to touch it — the
 *   operator is not trusted, it is unable.
 *
 *   `claim` sends to `account`, not to `msg.sender`. So the operator can
 *   submit the transaction and pay the gas on a reader's behalf, and still
 *   cannot redirect a single unit. This is why the EVM side needs no ERC-4337
 *   paymaster and no bundler: the reader never needs a transaction at all, so
 *   they never need ETH.
 */
contract Distributor {
    Drv public immutable token;
    bytes32 public immutable root;
    mapping(uint256 => bool) public claimed;

    event Claimed(uint256 indexed index, address indexed account, uint256 amount);

    constructor(Drv token_, bytes32 root_) {
        token = token_;
        root = root_;
    }

    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata proof) external {
        require(!claimed[index], "claimed");

        // Double hashing the leaf: a leaf that could also be read as an
        // internal node is how second-preimage attacks on Merkle trees work,
        // and the two hashes make the domains disjoint.
        bytes32 node = keccak256(bytes.concat(keccak256(abi.encode(index, account, amount))));
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            node = node < p ? keccak256(abi.encodePacked(node, p)) : keccak256(abi.encodePacked(p, node));
        }
        require(node == root, "proof");

        claimed[index] = true;
        require(token.transfer(account, amount), "transfer");
        emit Claimed(index, account, amount);
    }
}
