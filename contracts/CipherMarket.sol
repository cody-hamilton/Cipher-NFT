// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface ICipherNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @title Cipher Market
/// @notice A simple listing market with encrypted bids (only the listing seller is allowed to decrypt bids).
contract CipherMarket is ZamaEthereumConfig {
    enum ListingStatus {
        None,
        Active,
        AwaitingPayment,
        Sold,
        Cancelled
    }

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 priceWei;
        ListingStatus status;
        address acceptedBidder;
        uint256 acceptedPriceWei;
        uint40 createdAt;
        uint40 updatedAt;
    }

    struct Bid {
        address bidder;
        euint64 encryptedAmount;
        uint40 createdAt;
        bool cancelled;
        bool accepted;
    }

    event ListingCreated(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 priceWei);
    event ListingCancelled(uint256 indexed listingId);
    event ListingBought(uint256 indexed listingId, address indexed buyer, uint256 priceWei);

    event BidPlaced(uint256 indexed listingId, uint256 indexed bidId, address indexed bidder);
    event BidCancelled(uint256 indexed listingId, uint256 indexed bidId);
    event BidAccepted(uint256 indexed listingId, uint256 indexed bidId, address indexed bidder, uint256 clearPriceWei);
    event BidSettled(uint256 indexed listingId, address indexed buyer, uint256 clearPriceWei);

    event ProceedsWithdrawn(address indexed seller, uint256 amountWei);

    ICipherNFT public immutable nft;
    uint256 public listingCount;

    mapping(uint256 => Listing) private _listings;
    mapping(uint256 => Bid[]) private _bidsByListing;
    mapping(uint256 => uint256) public listingIdByTokenId;
    mapping(address => uint256) public proceeds;

    bool private _locked;

    constructor(address nftAddress) {
        require(nftAddress != address(0), "INVALID_NFT");
        nft = ICipherNFT(nftAddress);
    }

    modifier nonReentrant() {
        require(!_locked, "REENTRANCY");
        _locked = true;
        _;
        _locked = false;
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return _listings[listingId];
    }

    function getBidCount(uint256 listingId) external view returns (uint256) {
        return _bidsByListing[listingId].length;
    }

    function getBid(uint256 listingId, uint256 bidId) external view returns (Bid memory) {
        require(bidId < _bidsByListing[listingId].length, "BID_NOT_FOUND");
        return _bidsByListing[listingId][bidId];
    }

    function createListing(uint256 tokenId, uint256 priceWei) external nonReentrant returns (uint256 listingId) {
        require(priceWei > 0, "INVALID_PRICE");
        require(listingIdByTokenId[tokenId] == 0, "ALREADY_LISTED");
        require(nft.ownerOf(tokenId) == msg.sender, "NOT_OWNER");

        listingId = ++listingCount;

        _listings[listingId] = Listing({
            seller: msg.sender,
            tokenId: tokenId,
            priceWei: priceWei,
            status: ListingStatus.Active,
            acceptedBidder: address(0),
            acceptedPriceWei: 0,
            createdAt: uint40(block.timestamp),
            updatedAt: uint40(block.timestamp)
        });
        listingIdByTokenId[tokenId] = listingId;

        nft.transferFrom(msg.sender, address(this), tokenId);

        emit ListingCreated(listingId, msg.sender, tokenId, priceWei);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = _listings[listingId];
        require(listing.status == ListingStatus.Active, "NOT_ACTIVE");
        require(listing.seller == msg.sender, "NOT_SELLER");

        listing.status = ListingStatus.Cancelled;
        listing.updatedAt = uint40(block.timestamp);
        listingIdByTokenId[listing.tokenId] = 0;

        nft.transferFrom(address(this), listing.seller, listing.tokenId);

        emit ListingCancelled(listingId);
    }

    function buyNow(uint256 listingId) external payable nonReentrant {
        Listing storage listing = _listings[listingId];
        require(listing.status == ListingStatus.Active, "NOT_ACTIVE");
        require(msg.value == listing.priceWei, "WRONG_VALUE");

        listing.status = ListingStatus.Sold;
        listing.updatedAt = uint40(block.timestamp);
        listingIdByTokenId[listing.tokenId] = 0;

        proceeds[listing.seller] += msg.value;

        nft.transferFrom(address(this), msg.sender, listing.tokenId);

        emit ListingBought(listingId, msg.sender, msg.value);
    }

    function placeBid(uint256 listingId, externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        Listing storage listing = _listings[listingId];
        require(listing.status == ListingStatus.Active, "NOT_ACTIVE");
        require(msg.sender != listing.seller, "SELLER_CANNOT_BID");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _bidsByListing[listingId].push(
            Bid({
                bidder: msg.sender,
                encryptedAmount: amount,
                createdAt: uint40(block.timestamp),
                cancelled: false,
                accepted: false
            })
        );

        FHE.allowThis(amount);
        FHE.allow(amount, listing.seller);

        emit BidPlaced(listingId, _bidsByListing[listingId].length - 1, msg.sender);
    }

    function cancelBid(uint256 listingId, uint256 bidId) external {
        require(bidId < _bidsByListing[listingId].length, "BID_NOT_FOUND");
        Bid storage bid = _bidsByListing[listingId][bidId];
        require(bid.bidder == msg.sender, "NOT_BIDDER");
        require(!bid.cancelled, "ALREADY_CANCELLED");
        require(!bid.accepted, "ALREADY_ACCEPTED");
        bid.cancelled = true;
        emit BidCancelled(listingId, bidId);
    }

    function acceptBid(uint256 listingId, uint256 bidId, uint256 clearPriceWei) external {
        Listing storage listing = _listings[listingId];
        require(listing.status == ListingStatus.Active, "NOT_ACTIVE");
        require(listing.seller == msg.sender, "NOT_SELLER");
        require(clearPriceWei > 0, "INVALID_PRICE");
        require(bidId < _bidsByListing[listingId].length, "BID_NOT_FOUND");

        Bid storage bid = _bidsByListing[listingId][bidId];
        require(!bid.cancelled, "BID_CANCELLED");
        require(!bid.accepted, "BID_ALREADY_ACCEPTED");

        bid.accepted = true;
        listing.status = ListingStatus.AwaitingPayment;
        listing.acceptedBidder = bid.bidder;
        listing.acceptedPriceWei = clearPriceWei;
        listing.updatedAt = uint40(block.timestamp);

        emit BidAccepted(listingId, bidId, bid.bidder, clearPriceWei);
    }

    function settleAcceptedBid(uint256 listingId) external payable nonReentrant {
        Listing storage listing = _listings[listingId];
        require(listing.status == ListingStatus.AwaitingPayment, "NOT_AWAITING_PAYMENT");
        require(msg.sender == listing.acceptedBidder, "NOT_ACCEPTED_BIDDER");
        require(msg.value == listing.acceptedPriceWei, "WRONG_VALUE");

        listing.status = ListingStatus.Sold;
        listing.updatedAt = uint40(block.timestamp);
        listingIdByTokenId[listing.tokenId] = 0;

        proceeds[listing.seller] += msg.value;

        nft.transferFrom(address(this), msg.sender, listing.tokenId);

        emit BidSettled(listingId, msg.sender, msg.value);
    }

    function withdrawProceeds() external nonReentrant {
        uint256 amount = proceeds[msg.sender];
        require(amount > 0, "NO_PROCEEDS");
        proceeds[msg.sender] = 0;

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "WITHDRAW_FAILED");

        emit ProceedsWithdrawn(msg.sender, amount);
    }
}

