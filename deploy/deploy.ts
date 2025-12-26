import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedCipherNFT = await deploy("CipherNFT", {
    from: deployer,
    log: true,
  });

  const deployedCipherMarket = await deploy("CipherMarket", {
    from: deployer,
    args: [deployedCipherNFT.address],
    log: true,
  });

  console.log(`CipherNFT contract: `, deployedCipherNFT.address);
  console.log(`CipherMarket contract: `, deployedCipherMarket.address);
};
export default func;
func.id = "deploy_cipher"; // id required to prevent reexecution
func.tags = ["Cipher"];
