'use client'
import { useEffect, useState } from "react";
import { ConnectButton } from '@rainbow-me/rainbowkit'; // Will be resolved after adding dependency
import { useAccount, useSignMessage, useAccountEffect, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { BLACKJACK_NFT_ADDRESS, BLACKJACK_NFT_ABI } from '../config/contracts';

interface Card {
  rank: string;
  suit: string;
}

export default function App() {
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [isSigned, setIsSigned] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isGameActionLoading, setIsGameActionLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContract, data: writeData, error: writeContractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: transactionError } = useWaitForTransactionReceipt({ hash: writeData });

  useAccountEffect({
    onDisconnect() {
      console.log('断开连接!', isConnected, isSigned);
      sessionStorage.removeItem('jwt');
      setScore(0);
      setMessage('');
      setPlayerHand([]);
      setDealerHand([]);
      setIsSigned(false);
      setIsMinting(false);
      setIsGameActionLoading(false);
      setImgSrc('');
    },
  });
  
  useEffect(() => {
    if (isConfirmed && writeData) {
      setIsMinting(false); // writeContract 成功, 交易已确认
      setMessage('恭喜获得NFT！');
      setImgSrc("https://stuck-blush-sheep.myfilebase.com/ipfs/QmfMKjvaVwzKe76Ru2d83syiHQNBv3NKxTHpBVeCPNrWFL");
    }
  }, [isConfirmed, writeData]);

  useEffect(() => {
    if (writeContractError) {
      console.error('WriteContract Error:', writeContractError);
      setMessage(`铸造NFT失败: ${writeContractError.message.substring(0,100)}`);
      setIsMinting(false);
    }
    if (transactionError) {
      console.error('Transaction Error:', transactionError);
      setMessage(`NFT交易确认失败: ${transactionError.message.substring(0,100)}`);
      setIsMinting(false);
    }
  }, [writeContractError, transactionError]);

  const getSuitAppearance = (suit: string): { symbol: string, colorClass: string } => {
    const suitSymbols: { [key: string]: string } = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
    const symbol = suitSymbols[suit] || suit; 
    if (symbol === '♥' || symbol === '♦') {
      return { symbol: symbol, colorClass: 'text-red-500' };
    }
    return { symbol: symbol, colorClass: 'text-gray-800 dark:text-gray-300' };
  };

  async function handleApiCall(action: string, bodyData?: object) {
    setIsGameActionLoading(true);
    setMessage(''); 
    try {
      const response = await fetch('/api', {
        method: bodyData ? 'POST' : 'GET',
        headers: { bearer: `Bearer ${sessionStorage.getItem('jwt') || ''}` },
        body: bodyData ? JSON.stringify({ ...bodyData, address }) : undefined,
      });

      if (response.status === 401) {
        setIsSigned(false);
        sessionStorage.removeItem('jwt');
        setMessage('会话已过期，请重新签名。');
        return null;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '未知错误' }));
        setMessage(`操作失败: ${errorData.message || response.statusText}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error(`Error during ${action}:`, error);
      setMessage(`网络或服务器错误，请重试。`);
      return null;
    } finally {
      setIsGameActionLoading(false);
    }
  }

  async function handleHit() {
    const data = await handleApiCall('hit', { action: 'hit' });
    if (data) {
      setPlayerHand(data.playerHand);
      setMessage(data.message);
      setScore(data.score);
    }
  }

  async function handleStand() {
    const data = await handleApiCall('stand', { action: 'stand' });
    if (data) {
      setDealerHand(data.dealerHand);
      setMessage(data.message);
      setScore(data.score);
    }
  }

  async function initGame() {
    // Try POST first for new game, then GET as fallback or for existing game state
    const data = await handleApiCall('initGame', { action: 'deal' });
    if (data) {
        setPlayerHand(data.playerHand);
        setDealerHand(data.dealerHand);
        setMessage(data.message || '游戏开始！');
        setScore(data.score);
        setImgSrc(''); // Reset image on new game
    } else {
        // Fallback if POST fails or doesn't return full state
        const getResponse = await fetch(`/api?address=${address}`, { 
            method: 'GET', 
            headers: { bearer: `Bearer ${sessionStorage.getItem('jwt') || ''}` } 
        });
        if (getResponse.ok) {
            const getData = await getResponse.json();
            setPlayerHand(getData.playerHand);
            setDealerHand(getData.dealerHand);
            setMessage(getData.message || '游戏开始！');
            setScore(getData.score);
            setImgSrc('');
        } else {
             setMessage('开始游戏失败，请检查网络或刷新重试。');
        }
        setIsGameActionLoading(false); // ensure loading state is reset
    }
  }


  async function handleSign() {
    setIsGameActionLoading(true);
    try {
      const welcomeMessage = `欢迎来到Blackjack游戏，签名时间 ${new Date().toLocaleString()}`;
      const signature = await signMessageAsync({ message: welcomeMessage });
      const params = {
        action: 'auth',
        address,
        message: welcomeMessage,
        signature,
      };
      const response = await fetch('/api', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      if (response.ok) {
        const { jsonwebtoken } = await response.json();
        sessionStorage.setItem('jwt', jsonwebtoken);
        setIsSigned(true);
        await initGame(); 
      } else {
        const errorData = await response.json().catch(() => ({}));
        setMessage(`签名验证失败: ${errorData.message || '请重试'}`);
      }
    } catch (error: any) {
      console.error('Sign message error:', error);
      setMessage(`签名过程中发生错误: ${error.message ? error.message.substring(0,100) : '请重试'}`);
    } finally {
      setIsGameActionLoading(false);
    }
  }

  async function getNFT() {
    if (!address) {
      setMessage('请先连接钱包');
      return;
    }
    setIsMinting(true); 
    setMessage('正在提交NFT铸造请求...');
    try {
      await writeContract({
        abi: BLACKJACK_NFT_ABI,
        address: BLACKJACK_NFT_ADDRESS,
        functionName: 'mint',
        args: [address],
      });
      // Message setting for success/failure is handled by useEffect [isConfirmed, writeContractError, transactionError]
    } catch (error) { 
      // This catch might be redundant if writeContract itself doesn't throw for common cases handled by wagmi's error state.
      // However, it's good for unexpected errors during the call setup.
      console.error('Mint error during writeContract call:', error);
      // Only set message if not already handled by wagmi's error state in useEffect
      if (!writeContractError && !transactionError) {
          setMessage('铸造NFT时出错，请检查控制台。');
      }
      setIsMinting(false); // Ensure minting state is reset on direct error
    }
  }

  const renderCard = (card: Card, index: number, isDealerHiddenCard?: boolean) => {
    if (isDealerHiddenCard && index === 0 && dealerHand.length > 1 && (message === '' || message.includes('你的回合') || message.includes('游戏开始'))) {
      return (
        <div 
          key={`hidden-${index}`}
          className="w-20 h-28 sm:w-24 sm:h-36 bg-gray-500 rounded-lg shadow-md flex items-center justify-center border border-gray-400 transform transition-all duration-300"
        >
          <span className="text-white text-4xl">?</span>
        </div>
      );
    }

    const { symbol, colorClass } = getSuitAppearance(card.suit);
    return (
      <div 
        key={`${card.suit}-${card.rank}-${index}`} 
        className="w-20 h-28 sm:w-24 sm:h-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col justify-between p-1.5 sm:p-2 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      >
        <div className={`text-lg sm:text-xl font-bold self-start ${colorClass}`}>{card.rank}</div>
        <div className={`text-3xl sm:text-4xl self-center ${colorClass}`}>{symbol}</div>
        <div className={`text-lg sm:text-xl font-bold self-end rotate-180 ${colorClass}`}>{card.rank}</div>
      </div>
    );
  };

  const getMessageClass = () => {
    if (message.includes('win') || message.includes('恭喜')) return 'text-green-700 bg-green-100 dark:bg-green-700 dark:text-green-100 border-green-300 dark:border-green-600';
    if (message.includes('lose') || message.includes('爆牌') || message.includes('失败')) return 'text-red-700 bg-red-100 dark:bg-red-700 dark:text-red-100 border-red-300 dark:border-red-600';
    if (message.includes('平局')) return 'text-yellow-700 bg-yellow-100 dark:bg-yellow-700 dark:text-yellow-100 border-yellow-300 dark:border-yellow-600';
    return 'text-blue-700 bg-blue-100 dark:bg-blue-700 dark:text-blue-100 border-blue-300 dark:border-blue-600';
  };

  const Spinner = ({ size = 'w-5 h-5', color = 'border-gray-700 dark:border-gray-200' }) => (
    <div className={`${size} ${color} border-t-transparent border-solid rounded-full animate-spin`}></div>
  );

  if (!isSigned) {
    return (
      <div className="flex flex-col gap-6 items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-4">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 mb-4 sm:mb-8 text-center">
          Web3 Blackjack Deluxe
        </h1>
        <ConnectButton />
        {isConnected && (
          <button 
            onClick={handleSign} 
            disabled={isGameActionLoading}
            className="px-6 py-3 sm:px-8 sm:py-3 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-semibold rounded-lg shadow-md hover:from-sky-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-300 dark:focus:ring-cyan-700 focus:ring-opacity-75 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
          >
            {isGameActionLoading ? <Spinner color="border-white" /> : <span>使用钱包签名开始游戏</span>}
          </button>
        )}
         {message && <p className={`mt-4 text-base sm:text-lg p-3 rounded-md border ${getMessageClass()} w-full max-w-md text-center`}>{message}</p>}
      </div>
    );
  }

  const gameInProgress = message === '' || message === '游戏开始！' || message.includes('叫牌') || message.includes('等待') || message.includes('你的回合');

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 p-4 pt-6 sm:pt-8 space-y-4 sm:space-y-6">
      <div className="absolute top-4 right-4 z-50">
        <ConnectButton />
      </div>
      
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Web3 Blackjack</h1>
      
      <div className={`text-lg sm:text-xl font-semibold p-3 rounded-md border min-h-[3em] flex items-center justify-center text-center w-full max-w-md ${getMessageClass()}`}>
        {message || `分数: ${score}`}
      </div>
      
      { (score > 0 && !(message && (message.includes("游戏开始") || gameInProgress || message.includes("爆牌") || message.includes("输") || message.includes("lose") || message.includes("平局") ))) && (
         <p className="text-lg sm:text-xl font-medium text-gray-700 dark:text-gray-300">分数: {score}</p>
      )}

      {score >= 1000 && !imgSrc && (
        <div className="flex flex-col items-center gap-2 my-2 sm:my-4">
          <button 
            className={`px-5 py-2.5 sm:px-6 sm:py-3 font-semibold rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base
              ${isMinting || isConfirming 
                ? 'bg-gray-400 dark:bg-gray-600 text-gray-100 dark:text-gray-300 cursor-not-allowed' 
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
            }`}
            onClick={getNFT}
            disabled={isMinting || isConfirming || isGameActionLoading}
          >
            {(isMinting || isConfirming) ? <Spinner color="border-white" /> : null}
            <span>
              {isMinting ? '提交交易中...' : isConfirming ? '等待网络确认...' : '获取NFT资格徽章!'}
            </span>
          </button>
        </div>
      )}

      {imgSrc && (
        <div className="border-2 border-yellow-400 dark:border-yellow-500 rounded-lg p-3 sm:p-4 bg-white dark:bg-gray-700 shadow-xl my-4 sm:my-6 animate-fade-in">
          <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 text-yellow-500 dark:text-yellow-400 text-center">Blackjack NFT 徽章</h3>
          <img src={imgSrc} alt="Blackjack NFT" className="w-40 h-40 sm:w-56 sm:h-56 object-cover rounded-md mx-auto shadow-lg" />
        </div>
      )}

      {/* Dealer's Hand */}
      <div className="w-full max-w-md sm:max-w-2xl">
        <h2 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3 text-center text-gray-700 dark:text-gray-200">庄家手牌</h2>
        <div className="flex flex-row gap-2 sm:gap-3 justify-center items-center min-h-[8rem] sm:min-h-[10rem] bg-gray-100 dark:bg-gray-700 p-3 sm:p-4 rounded-lg shadow-inner">
          {dealerHand.length > 0 ? dealerHand.map((card, index) => renderCard(card, index, true)) : <p className="text-gray-500 dark:text-gray-400">等待庄家亮牌...</p>}
        </div>
      </div>

      {/* Player's Hand */}
      <div className="w-full max-w-md sm:max-w-2xl">
        <h2 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3 text-center text-gray-700 dark:text-gray-200">玩家手牌</h2>
        <div className="flex flex-row gap-2 sm:gap-3 justify-center items-center min-h-[8rem] sm:min-h-[10rem] bg-gray-100 dark:bg-gray-700 p-3 sm:p-4 rounded-lg shadow-inner">
          {playerHand.length > 0 ? playerHand.map((card, index) => renderCard(card, index)) : <p className="text-gray-500 dark:text-gray-400">等待发牌...</p>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-row gap-3 sm:gap-4 mt-4 sm:mt-6">
        {gameInProgress ? (
          <>
            <button 
              className="px-6 py-2.5 sm:px-8 sm:py-3 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-500 focus:ring-opacity-75 transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
              onClick={handleHit}
              disabled={isGameActionLoading || isMinting || isConfirming}
            >
              {isGameActionLoading && message.toLowerCase().includes("hit") ? <Spinner size="w-4 h-4" color="border-white" /> : null} <span>叫牌</span>
            </button>
            <button 
              className="px-6 py-2.5 sm:px-8 sm:py-3 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 focus:ring-opacity-75 transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
              onClick={handleStand}
              disabled={isGameActionLoading || isMinting || isConfirming}
            >
              {isGameActionLoading && message.toLowerCase().includes("stand") ? <Spinner size="w-4 h-4" color="border-white" /> : null} <span>停牌</span>
            </button>
          </>
        ) : (
          <button 
            className="px-6 py-2.5 sm:px-8 sm:py-3 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-500 focus:ring-opacity-75 transition-all duration-150 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
            onClick={initGame}
            disabled={isGameActionLoading || isMinting || isConfirming}
          >
           {isGameActionLoading && message.toLowerCase().includes("reset") ? <Spinner size="w-4 h-4" color="border-white" /> : null} <span>重新开始</span>
          </button>
        )}
      </div>
      <footer className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 py-6 sm:py-8">
        Blackjack Game &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}