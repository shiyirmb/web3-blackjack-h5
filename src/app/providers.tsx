'use client'

import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { type State, WagmiProvider } from 'wagmi'
import {
  getDefaultConfig,
  RainbowKitProvider,
  Chain,
} from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains'

import { getConfig } from '@/wagmi'

export function Providers(props: {
  children: ReactNode
  initialState?: State
}) {
  // const [config] = useState(() => getConfig())
  // 自定义链
  const AssetHub = {
    id: 420420421,
    name: 'Westend Asset Hub',
    iconUrl: 'https://assethub-westend.subscan.io/_next/image?url=%2Fchains%2Fassethub-westend%2Flogo-mini.png&w=1920&q=75',
    iconBackground: '#fff',
    nativeCurrency: { name: 'Westend Asset Hub', symbol: 'WND', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://westend-asset-hub-eth-rpc.polkadot.io'] },
    },
    blockExplorers: {
      default: { name: 'Subscan', url: 'https://westend-asset-hub.subscan.io' },
    },
    testnet: true,
    contracts: {
      multicall3: {
        address: '0xca11bde05977b3631167028862be2a173976ca11',
        blockCreated: 1,
      },
    },
  } as const satisfies Chain
  const config = getDefaultConfig({
    appName: 'BlackJack',
    projectId: '20250501',
    chains: [sepolia, AssetHub],
  }) as any
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config} initialState={props.initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {props.children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
