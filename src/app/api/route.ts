import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
    DynamoDBDocumentClient, 
    PutCommand, 
    GetCommand,
    UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { verifyMessage } from "viem";
import jwt from 'jsonwebtoken'

// 创建 DynamoDB 客户端
const client = new DynamoDBClient({
  region: process.env.AWS_REGION, // your-region 例如 "us-east-1"
  credentials: {
    accessKeyId: process.env.AWS_USER_ACCESS_KEY_ID || '', // your-access-key-id
    secretAccessKey: process.env.AWS_USER_ACCESS_KEY_SECRET || '', // your-secret-access-key
  }
});

// 创建文档客户端
const docClient = DynamoDBDocumentClient.from(client);

// 写入分数
async function writeScore(player: string, score: number): Promise<void> {
  try {
    const oldScore = await readScore(player)
    const command = new PutCommand({
      TableName: "BlackJack",
      Item: { player, score: oldScore + score }
    });

    await docClient.send(command);
    console.log(`Successfully wrote score for player ${player}`);
  } catch (error) {
    console.error("Error writing score:", error);
    throw error;
  }
}

// 读取分数
async function readScore(player: string): Promise<number> {
  try {
    const command = new GetCommand({
        TableName: "BlackJack",
        Key: { player }
    });

    const response = await docClient.send(command);
    return response.Item?.score ?? 0;
  } catch (error) {
    console.error("Error reading score:", error);
    throw error;
  }
}

export interface Card {
  rank: string,
  suit: string,
}

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const suits = ['♠️', '♥️', '♦️', '♣️']
const initialCards = ranks.map(rank => suits.map(suit => ({ rank, suit }))).flat()

// 游戏状态初始化值
const gameState: {
  playerHand: Card[], // 玩家手牌
  dealerHand: Card[], // 庄家手牌
  cards: Card[], // 全部手牌 52张牌
  message: string, // 提示信息
  score: number, // 得分
} = {
  playerHand: [],
  dealerHand: [],
  cards: initialCards,
  message: '',
  score: 0,
}

// 叫牌抽卡的公用方法
function getRandomCards(cards: Card[], count: number) {
  const randomIndexSet = new Set<number>()
  while (randomIndexSet.size < count) {
    randomIndexSet.add(Math.floor(Math.random() * cards.length))
  }
  // 抽取的卡牌
  const randomCards = cards.filter((_, index) => randomIndexSet.has(index))
  // 抽取后剩余的卡牌
  const remainingCards = cards.filter((_, index) => !randomIndexSet.has(index))
  return [randomCards, remainingCards]
}
// 计算卡牌总点数的公用方法
function calculateCardsTotal(cards: Card[]) {
  let total = 0
  let aceCount = 0
  cards.forEach(card => {
    if (card.rank === 'A') {
      total += 11
      aceCount++
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      total += 10
    } else {
      total += Number(card.rank)
    }
    while(total > 21 && aceCount > 0) {
      total -= 10
      aceCount--
    }
  })
  return total
}
// 发送给前端数据的公用方法
async function sendSuccessDataToFront(address: string) {
  try {
    // 读取分数
    const score = await readScore(address)
    return new Response(JSON.stringify(
      {
        playerHand: gameState.playerHand,
        // 游戏未结束时，玩家只能看到庄家的第一张牌
        dealerHand: !gameState.message ? [gameState.dealerHand[0], { rank: '?', suit: '?'} as Card] : gameState.dealerHand,
        message: gameState.message,
        score,
      }
    ), {
      status: 200,
    })
  } catch (error) {
    console.error("写入分数出错:", error)
    return sendErrorDataToFront('write score error.', 500)
  }
}
// 发送给前端错误信息的公用方法
function sendErrorDataToFront(message: string, status: number) {
  return new Response(JSON.stringify({ message }), { status })
}

// 初始化获取卡牌
export async function GET(request: Request) {
  const url = new URL(request.url)
  const address = url.searchParams.get('address')
  console.log(`玩家${address}获取卡牌`);
  if (!address) {
    return sendErrorDataToFront('Address is required', 500)
  }

  // 重置游戏状态
  gameState.playerHand = []
  gameState.dealerHand = []
  gameState.cards = initialCards
  gameState.message = ''

  // 初始化逻辑：
  // 1、玩家随机获取两张牌
  // 2、庄家随机获取两张牌
  const [playerCards, remainingCards] = getRandomCards(gameState.cards, 2)
  const [dealerCards, newCards] = getRandomCards(remainingCards, 2)
  gameState.playerHand = playerCards
  gameState.dealerHand = dealerCards
  gameState.cards = newCards

  try {
    // 读取分数
    const score = await readScore(address)
    console.log("当前分数:", score)
    // 特殊处理，初始化获取的两张牌，可能为21点
    const playerCardsTotal = calculateCardsTotal(gameState.playerHand)
    const dealerCardsTotal = calculateCardsTotal(gameState.dealerHand)
    if (playerCardsTotal === 21 && dealerCardsTotal === 21) {
      gameState.message = 'draw'
    } else if (playerCardsTotal === 21) {
      gameState.message = "Player win, Black jack"
      console.log(gameState.message)
      await writeScore(address, 100);
    } else if (dealerCardsTotal === 21) {
      gameState.message = "Player lose, Dealer black jack"
      console.log(gameState.message)
      await writeScore(address, -100)
    }
    return sendSuccessDataToFront(address)
  } catch (error) {
    console.error("读取分数出错:", error)
    return sendErrorDataToFront('read score error.', 500)
  }
}

// 叫牌/停牌/签名校验
export async function POST(request: Request) {
  const { action, address, message, signature } = await request.json()
  if (action === 'auth') {
    console.log('进入签名校验逻辑')
    const isValid = await verifyMessage({ address, message, signature })
    console.log('签名校验是否通过', isValid)
    if (!isValid) {
      return sendErrorDataToFront('Invalid signature', 400)
    } else {
      const token = jwt.sign({ address }, process.env.JWT_SECRET || '', { expiresIn: "1h" })
      return new Response(JSON.stringify({
        message: 'Valid signature',
        jsonwebtoken: token,
      }), { status: 200 })
    }
  }

  const token = request.headers.get('bearer')?.split(' ')[1]
  if (!token) {
    return sendErrorDataToFront('Token is required', 401)
  }
  const decode = jwt.verify(token, process.env.JWT_SECRET || '') as { address: string }
  console.log('校验玩家身份', decode);
  if (decode.address.toLocaleLowerCase() !== address.toLocaleLowerCase()) {
    return sendErrorDataToFront('Invalid token', 401)
  }

  if (action === 'hit') {
    console.log('进入叫牌逻辑')
    // 玩家操作逻辑：
    // 1、点击叫牌按钮，随机获取一张卡牌到玩家手牌中
    // 2、判断玩家手牌总点数
    // 2-1、如果玩家手牌大于21，提示信息：玩家失败，爆牌
    // 2-2、如果玩家手牌等于21，提示信息：玩家胜利，21点
    // 2-2、如果玩家手牌小于21，玩家可以继续叫牌或者停牌
    const [randomCards, remainingCards] = getRandomCards(gameState.cards, 1)
    gameState.playerHand.push(...randomCards)
    gameState.cards = remainingCards
    const playerCardsTotal = calculateCardsTotal(gameState.playerHand)
    if (playerCardsTotal > 21) {
      gameState.message = "Player lose, Bust"
      console.log(gameState.message)
      await writeScore(address, -100)
    } else if (playerCardsTotal === 21) {
      gameState.message = "Player win, Black jack"
      console.log(gameState.message)
      await writeScore(address, 100)
    }
    return sendSuccessDataToFront(address)
  }
  if (action === 'stand') {
    console.log('进入停牌逻辑')
    // 庄家操作逻辑：
    // 1、玩家点击停牌时，随机获取一张卡牌到庄家手牌中
    // 2、持续获取卡牌到庄家手牌，庄家手牌总点数为17或者大于17时停止
    // 3、如果庄家手牌大于21，玩家胜利，提示信息：庄家爆牌
    // 4、如果庄家手牌等于21，玩家失败，提示信息：庄家21点
    // 5、如果庄家手牌小于21
    // 5-1、如果庄家手牌总点数大于玩家手牌，玩家失败，提示信息：玩家失败
    // 5-2、如果庄家手牌总点数小于玩家手牌，玩家胜利，提示信息：玩家胜利
    // 5-3、如果庄家手牌总点数等于玩家手牌，平牌，提示信息：平牌
    while(calculateCardsTotal(gameState.dealerHand) < 17) {
      const [randomCards, remainingCards] = getRandomCards(gameState.cards, 1)
      gameState.dealerHand.push(...randomCards)
      gameState.cards = remainingCards
    }
    const dealerCardsTotal = calculateCardsTotal(gameState.dealerHand)
    if (dealerCardsTotal > 21) {
      gameState.message = "Player win, Dealer bust"
      console.log(gameState.message)
      await writeScore(address, 100)
    } else if (dealerCardsTotal === 21) {
      gameState.message = "Player lose, Dealer black jack"
      console.log(gameState.message)
      await writeScore(address, -100)
    } else {
      const playerCardsTotal = calculateCardsTotal(gameState.playerHand)
      if (dealerCardsTotal > playerCardsTotal) {
        gameState.message = "Player lose"
        console.log(gameState.message)
        await writeScore(address, -100)
      } else if (dealerCardsTotal < playerCardsTotal) {
        gameState.message = "Player win"
        console.log(gameState.message)
        await writeScore(address, 100)
      } else {
        gameState.message = "draw"
        console.log(gameState.message)
      }
    }
    return sendSuccessDataToFront(address)
  }
  return sendErrorDataToFront('Invalid action.', 400)
}
