// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

interface IERC721 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function setApprovalForAll(address operator, bool _approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

contract BlackjackNFT is IERC721 {
    string private constant _name = "BlackjackNFT";
    string private constant _symbol = "BJN";
    string private constant _baseURI = 'ipfs://QmNgEPicSo9F5zrEFD1wZZTKGHLMBZmGtRHPCGvpKALY7g';
    
    uint256 public currentTokenId;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    function mint(address to) external returns (uint256) {
        require(to != address(0), "Zero address");
        uint256 tokenId = ++currentTokenId;
        _owners[tokenId] = to;
        _balances[to]++;
        emit Transfer(address(0), to, tokenId);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        return _baseURI;
    }

    function balanceOf(address owner) external view override returns (uint256) {
        require(owner != address(0), "Zero address");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) external view override returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Invalid token");
        return owner;
    }

    function approve(address to, uint256 tokenId) external override {
        address owner = _owners[tokenId];
        require(to != owner, "Approve to owner");
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "Not owner nor approved");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view override returns (address) {
        require(_owners[tokenId] != address(0), "Invalid token");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external override {
        require(operator != msg.sender, "Approve to caller");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) external override {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner nor approved");
        require(to != address(0), "Zero address");
        
        _owners[tokenId] = to;
        _balances[from]--;
        _balances[to]++;
        delete _tokenApprovals[tokenId];
        
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external override {
        this.transferFrom(from, to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = _owners[tokenId];
        return (spender == owner || 
                _tokenApprovals[tokenId] == spender || 
                isApprovedForAll(owner, spender));
    }
}