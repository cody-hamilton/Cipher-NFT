// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC165 interface.
interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @notice Minimal ERC721 interface (subset used by this project).
interface IERC721 is IERC165 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);

    function approve(address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address);

    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);

    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
}

/// @notice ERC721 receiver interface.
interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4);
}

/// @title Cipher NFT
/// @notice Everyone can mint exactly one NFT for free.
contract CipherNFT is IERC721 {
    string public name = "Cipher NFT";
    string public symbol = "CIPHER";

    uint256 public totalSupply;

    mapping(uint256 => address) private _ownerOf;
    mapping(address => uint256) private _balanceOf;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    mapping(address => bool) private _minted;

    mapping(address => uint256[]) private _ownedTokens;
    mapping(uint256 => uint256) private _ownedTokensIndex;

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 /* ERC165 */ || interfaceId == 0x80ac58cd /* ERC721 */;
    }

    function hasMinted(address account) external view returns (bool) {
        return _minted[account];
    }

    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownedTokens[owner];
    }

    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "INVALID_OWNER");
        return _balanceOf[owner];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _ownerOf[tokenId];
        require(owner != address(0), "NOT_MINTED");
        return owner;
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        require(_ownerOf[tokenId] != address(0), "NOT_MINTED");
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function approve(address to, uint256 tokenId) external {
        address owner = _ownerOf[tokenId];
        require(owner != address(0), "NOT_MINTED");
        require(to != owner, "APPROVE_TO_OWNER");
        require(msg.sender == owner || _operatorApprovals[owner][msg.sender], "NOT_AUTHORIZED");

        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        require(operator != msg.sender, "APPROVE_TO_CALLER");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(to != address(0), "INVALID_TO");
        address owner = _ownerOf[tokenId];
        require(owner != address(0), "NOT_MINTED");
        require(owner == from, "WRONG_FROM");
        require(_isApprovedOrOwner(msg.sender, tokenId), "NOT_AUTHORIZED");

        _beforeTokenTransfer(from, to, tokenId);

        delete _tokenApprovals[tokenId];
        _ownerOf[tokenId] = to;

        unchecked {
            _balanceOf[from] -= 1;
            _balanceOf[to] += 1;
        }

        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        _safeTransferFrom(from, to, tokenId, bytes(""));
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) public {
        _safeTransferFrom(from, to, tokenId, data);
    }

    function mint() external returns (uint256 tokenId) {
        require(!_minted[msg.sender], "ALREADY_MINTED");
        _minted[msg.sender] = true;

        tokenId = ++totalSupply;
        _safeMint(msg.sender, tokenId);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf[tokenId] != address(0), "NOT_MINTED");

        string memory id = _toString(tokenId);
        string memory svg = string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">',
                '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">',
                '<stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#4f46e5"/></linearGradient></defs>',
                '<rect width="600" height="600" fill="url(#g)"/>',
                '<text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-size="44" font-family="ui-sans-serif,system-ui">',
                "Cipher NFT</text>",
                '<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#d1d5db" font-size="28" font-family="ui-sans-serif,system-ui">',
                "#",
                id,
                "</text></svg>"
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;utf8,",
                '{"name":"Cipher NFT #',
                id,
                '","description":"Cipher NFT: free mint, one per address.","image":"data:image/svg+xml;utf8,',
                svg,
                '"}'
            )
        );
    }

    function _safeMint(address to, uint256 tokenId) internal {
        require(to != address(0), "INVALID_TO");
        require(_ownerOf[tokenId] == address(0), "ALREADY_MINTED");

        _beforeTokenTransfer(address(0), to, tokenId);

        _ownerOf[tokenId] = to;
        _balanceOf[to] += 1;

        emit Transfer(address(0), to, tokenId);
        require(_checkOnERC721Received(msg.sender, address(0), to, tokenId, bytes("")), "UNSAFE_RECIPIENT");
    }

    function _safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) internal {
        transferFrom(from, to, tokenId);
        require(_checkOnERC721Received(msg.sender, from, to, tokenId, data), "UNSAFE_RECIPIENT");
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = _ownerOf[tokenId];
        return spender == owner || _tokenApprovals[tokenId] == spender || _operatorApprovals[owner][spender];
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal {
        if (from != address(0)) {
            _removeTokenFromOwnerEnumeration(from, tokenId);
        }
        if (to != address(0)) {
            _addTokenToOwnerEnumeration(to, tokenId);
        }
    }

    function _addTokenToOwnerEnumeration(address to, uint256 tokenId) private {
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
    }

    function _removeTokenFromOwnerEnumeration(address from, uint256 tokenId) private {
        uint256 lastIndex = _ownedTokens[from].length - 1;
        uint256 tokenIndex = _ownedTokensIndex[tokenId];

        if (tokenIndex != lastIndex) {
            uint256 lastTokenId = _ownedTokens[from][lastIndex];
            _ownedTokens[from][tokenIndex] = lastTokenId;
            _ownedTokensIndex[lastTokenId] = tokenIndex;
        }

        _ownedTokens[from].pop();
        delete _ownedTokensIndex[tokenId];
    }

    function _checkOnERC721Received(address operator, address from, address to, uint256 tokenId, bytes memory data)
        private
        returns (bool)
    {
        if (to.code.length == 0) return true;
        try IERC721Receiver(to).onERC721Received(operator, from, tokenId, data) returns (bytes4 value) {
            return value == IERC721Receiver.onERC721Received.selector;
        } catch {
            return false;
        }
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
