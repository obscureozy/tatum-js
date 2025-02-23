import { Container, Service } from 'typedi'
import { isLoadBalancerNetwork } from '../../dto'
import { EvmBasedRpcSuite, SolanaRpcSuite, TronRpcSuite, UtxoBasedRpcSuite, XrpRpcSuite } from '../../dto/rpc'
import { CONFIG, Constant, Utils } from '../../util'
import { Address, AddressTezos, AddressTron } from '../address'
import { FeeEvm, FeeUtxo } from '../fee'
import { Nft, NftTezos } from '../nft'
import { Notification } from '../notification'
import { Rates } from '../rate'
import { LoadBalancer } from '../rpc/generic/LoadBalancer'
import { Token } from '../token'
import { WalletProvider } from '../walletProvider'
import { ApiVersion, TatumConfig } from './tatum.dto'
import { TatumSdkContainer, TatumSdkExtension } from "../extensions";

export interface ITatumSdkChain {
    extension<T extends TatumSdkExtension>(type: new (tatumSdkContainer: TatumSdkContainer, ...args: unknown[]) => T): T
}

export abstract class TatumSdkChain implements ITatumSdkChain {
    protected constructor(readonly id: string) { }

    extension<T extends TatumSdkExtension>(type: new (tatumSdkContainer: TatumSdkContainer, ...args: unknown[]) => T): T {
        return Container.of(this.id).get(type);
    }

    destroy(): void {
      Container.of(this.id).reset( {strategy: 'resetServices' })
    }
}

export class BaseTatumSdk extends TatumSdkChain {
  notification: Notification
  nft: Nft
  token: Token
  address: Address
  walletProvider: WalletProvider
  rates: Rates

  constructor(id: string) {
    super(id)
    this.notification = Container.of(id).get(Notification)
    this.nft = Container.of(id).get(Nft)
    this.token = Container.of(id).get(Token)
    this.walletProvider = Container.of(id).get(WalletProvider)
    this.address = Container.of(id).get(Address)
    this.rates = Container.of(id).get(Rates)
  }
}

export abstract class BaseUtxoClass extends BaseTatumSdk {
  rpc: UtxoBasedRpcSuite
  fee: FeeUtxo

  constructor(id: string) {
    super(id)
    this.rpc = Utils.getRpc<UtxoBasedRpcSuite>(id, Container.of(id).get(CONFIG))
    this.fee = Container.of(id).get(FeeUtxo)
  }
}

export abstract class BaseEvmClass extends BaseTatumSdk {
  rpc: EvmBasedRpcSuite

  constructor(id: string) {
    super(id)
    this.rpc = Utils.getRpc<EvmBasedRpcSuite>(id, Container.of(id).get(CONFIG))
  }
}

export class Ethereum extends BaseEvmClass {
  fee: FeeEvm

  constructor(id: string) {
    super(id)
    this.fee = Container.of(id).get(FeeEvm)
  }
}
export class ArbitrumNova extends BaseEvmClass {}
export class ArbitrumOne extends BaseEvmClass {}
export class Aurora extends BaseEvmClass {}
export class AvalancheC extends BaseEvmClass {}
export class BinanceSmartChain extends BaseEvmClass {}
export class Celo extends BaseEvmClass {}
export class Cronos extends BaseEvmClass {}
export class EthereumClassic extends BaseEvmClass {}
export class Fantom extends BaseEvmClass {}
export class Gnosis extends BaseEvmClass {}
export class Haqq extends BaseEvmClass {}
export class Flare extends BaseEvmClass {}
export class HarmonyOne extends BaseEvmClass {}
export class Klaytn extends BaseEvmClass {}
export class Kucoin extends BaseEvmClass {}
export class Oasis extends BaseEvmClass {}
export class Optimism extends BaseEvmClass {}
export class Palm extends BaseEvmClass {}
export class Polygon extends BaseEvmClass {}
export class Vechain extends BaseEvmClass {}
export class Xdc extends BaseEvmClass {}
export class HorizenEon extends BaseEvmClass {}

// UTXO chains
export class Bitcoin extends BaseUtxoClass {}
export class Litecoin extends BaseUtxoClass {}
export class Dogecoin extends BaseUtxoClass {}
export class BitcoinCash extends BaseUtxoClass {}

// other chains
export class Xrp extends BaseTatumSdk {
  rpc: XrpRpcSuite
  constructor(id: string) {
    super(id)
    this.rpc = Utils.getRpc<XrpRpcSuite>(id, Container.of(id).get(CONFIG))
  }
}
export class Solana extends BaseTatumSdk {
  rpc: SolanaRpcSuite
  constructor(id: string) {
    super(id)
    this.rpc = Utils.getRpc<SolanaRpcSuite>(id, Container.of(id).get(CONFIG))
  }
}
export class Tron extends TatumSdkChain {
  notification: Notification
  nft: Nft
  token: Token
  address: AddressTron
  walletProvider: WalletProvider
  rates: Rates
  rpc: TronRpcSuite

  constructor(id: string) {
    super(id)
    this.notification = Container.of(id).get(Notification)
    this.nft = Container.of(id).get(Nft)
    this.token = Container.of(id).get(Token)
    this.walletProvider = Container.of(id).get(WalletProvider)
    this.address = Container.of(id).get(AddressTron)
    this.rates = Container.of(id).get(Rates)
    this.rpc = Utils.getRpc<TronRpcSuite>(id, Container.of(id).get(CONFIG))
  }
}

export class Tezos extends TatumSdkChain {
  notification: Notification
  address: AddressTezos
  nft: NftTezos

  constructor(id: string) {
    super(id)
    this.notification = Container.of(id).get(Notification)
    this.address = Container.of(id).get(AddressTezos)
    this.nft = Container.of(this.id).get(NftTezos)
  }
}

@Service({ transient: true })
export class TatumSDK {
  /**
   * Initialize Tatum SDK. This method must be called before any other method.
   * Default configuration is used if no configuration is provided.
   * @param config
   */
  public static async init<T extends ITatumSdkChain>(config: TatumConfig): Promise<T> {
    const defaultConfig: Partial<TatumConfig> = {
      version: ApiVersion.V4,
      retryCount: 1,
      retryDelay: 1000,
      rpc: {
        oneTimeLoadBalancing: false,
        allowedBlocksBehind: Constant.OPEN_RPC.ALLOWED_BLOCKS_BEHIND,
      },
    }

    const mergedConfig = Utils.deepMerge(defaultConfig, config) as TatumConfig

    // TODO: check when rpc is customized if there is allowedBlocksBehind if not throw error or set default
    // TODO: Check if rpc works for other chains and all configurations are set correctly

    const id = TatumSDK.generateRandomString()
    Container.of(id).set(CONFIG, mergedConfig)
    if (isLoadBalancerNetwork(mergedConfig.network)) {
      const loadBalancer = Container.of(id).get(LoadBalancer)
      await loadBalancer.init()
    }

    await this.configureExtensions(config, id)

    return Utils.getClient<T>(id, mergedConfig.network)
  }

  private static async configureExtensions(config: TatumConfig, id: string) {
    for (const extensionConfig of config?.configureExtensions ?? []) {
      let type: new (container: TatumSdkContainer, ...args: unknown[]) => TatumSdkExtension
      const args: unknown[] = []

      if ('type' in extensionConfig) {
        type = extensionConfig.type
        args.push(extensionConfig.config)
      } else {
        type = extensionConfig
      }

      const containerInstance = new TatumSdkContainer(Container.of(id))
      const instance = new type(containerInstance, ...args)
      await instance.init(...args)
      Container.of(id).set(type, instance)
    }
  }

  private static generateRandomString() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 60; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return result
  }
}
