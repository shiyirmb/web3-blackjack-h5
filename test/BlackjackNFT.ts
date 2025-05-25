import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, BigNumber } from "ethers";

describe("BlackjackNFT", function () {
  let blackjackNFT: Contract;
  let owner: any;
  let addr1: any;
  let addr2: any;
  const baseTokenURI = "https://stuck-blush-sheep.myfilebase.com/ipfs/QmNgEPicSo9F5zrEFD1wZZTKGHLMBZmGtRHPCGvpKALY7g/";

  beforeEach(async function () {
    console.log("开始部署合约...");
    [owner, addr1, addr2] = await ethers.getSigners();
    const BlackjackNFT = await ethers.getContractFactory("BlackjackNFT");
    blackjackNFT = await BlackjackNFT.deploy(baseTokenURI);
    await blackjackNFT.deployed();
    console.log("合约部署成功，地址:", blackjackNFT.address);
  });

  describe("合约基本信息", function () {
    it("应该正确设置合约名称和符号", async function () {
      console.log("测试合约名称和符号...");
      expect(await blackjackNFT.name()).to.eql("BlackjackNFT");
      expect(await blackjackNFT.symbol()).to.eql("BJN");
      console.log("合约名称和符号验证通过");
    });

    it("应该正确设置baseTokenURI", async function () {
      console.log("测试baseTokenURI设置...");
      expect(await blackjackNFT.baseTokenURI()).to.eql(baseTokenURI);
      console.log("baseTokenURI设置验证通过");
    });
  });

  describe("NFT铸造功能", function () {
    it("应该允许任何人铸造NFT", async function () {
      console.log("测试NFT铸造功能...");
      const tx = await blackjackNFT.connect(addr1).mint(addr1.address);
      await tx.wait();
      
      expect(await blackjackNFT.ownerOf(1)).to.eql(addr1.address);
      expect((await blackjackNFT.currentTokenId()).toString()).to.eql('1');
      console.log("NFT铸造成功，tokenId: 1, 所有者:", addr1.address);
    });

    it("应该正确递增tokenId", async function () {
      console.log("测试tokenId递增...");
      const tx1 = await blackjackNFT.connect(addr1).mint(addr1.address);
      await tx1.wait();
      
      const tx2 = await blackjackNFT.connect(addr2).mint(addr2.address);
      await tx2.wait();
      
      expect((await blackjackNFT.currentTokenId()).toString()).to.eql("2");
      console.log("tokenId递增验证通过，当前tokenId: 2");
    });
  });

  describe("tokenURI功能", function () {
    it("应该返回正确的tokenURI", async function () {
      console.log("测试tokenURI功能...");
      console.log("开始铸造NFT...");
      const mintTx = await blackjackNFT.connect(addr1).mint(addr1.address);
      console.log("等待mint交易完成...");
      await mintTx.wait();
      console.log("mint交易完成，当前tokenId:", (await blackjackNFT.currentTokenId()).toString());
      
      console.log("获取tokenURI...");
      const tokenURI = await blackjackNFT.tokenURI(1);
      console.log("获取到的tokenURI:", tokenURI);
      expect(tokenURI.toString()).to.eql(String(baseTokenURI + 1));
      console.log("tokenURI验证通过:", tokenURI);
    });

    it("应该对不存在的tokenId抛出错误", async function () {
      console.log("测试不存在的tokenId...");

      let errorThrown = false;
      try {
        await blackjackNFT.tokenURI(999);
      } catch (error) {
        errorThrown = true;
      }
      expect(errorThrown).to.be.true;
      console.log("不存在的tokenId错误处理验证通过");
    });
  });

  describe("NFT所有权转移", function () {
    it.only("应该允许NFT所有者转移NFT", async function () {
      console.log("测试NFT转移功能...");
      const minxTx = await blackjackNFT.connect(addr1).mint(addr1.address);
      console.log("等待mint交易完成...");
      await minxTx.wait()
      
      const tx = await blackjackNFT.connect(addr1).transferFrom(addr1.address, addr2.address, 1);
      console.log("等待transfer交易完成...");
      await tx.wait()
      expect(await blackjackNFT.ownerOf(1)).to.eql(addr2.address);
      console.log("NFT转移成功，新所有者:", addr2.address);
    });
  });
});
