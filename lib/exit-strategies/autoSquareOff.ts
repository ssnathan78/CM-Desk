import { eq } from "drizzle-orm"
import type { KiteOrder } from "../../types/kite"
import type {
  ATM_STRADDLE_TRADE,
  ATM_STRANGLE_TRADE,
  SUPPORTED_TRADE_CONFIG,
} from "../../types/trade"
import { STATUS_TRIGGER_PENDING, USER_OVERRIDE } from "../constants"
import { db } from "../drizzle"
import { patchDbTrade } from "../drizzleDbUtils"
import { LIVE_FLATTEN_MARKET_CLOSED, liveFlattenSessionBlock } from "../flattenNotice"
import {
  getCompletedOrdersbyTag,
  type PlaceOrderParams,
  placeOrder,
  remoteOrderSuccessEnsurer,
  syncGetKiteInstance,
} from "../kiteUtils"
import logger from "../logger"
import { jobExecutions } from "../schema"
import { ledgerRowsForActiveBook, squareOffQtySource } from "../trading/bookSplit"
import {
  protectiveOrderMatchesJob,
  resolveSquareOffBook,
  SQUARE_OFF_STRATEGY_REQUIRED,
} from "../trading/exitSafety"
import { getOpenPositions } from "../trading/ledger"
import { cancelPaperWorkingOrders } from "../trading/paperExecution"
import { strategyFromOrderTag } from "../trading/riskGate"
import { getRiskSettings } from "../trading/riskSettings"
import { isMarketOpen, isMockOrder, withRemoteRetry } from "../utils"

async function squareOffStrategy(input: {
  strategy?: string | null
  orderTag?: string | null
}): Promise<string | null> {
  if (input.strategy) return input.strategy
  return strategyFromOrderTag(input.orderTag)
}

export async function doDeletePendingOrders(
  orders: KiteOrder[],
  kite: any,
  context?: { strategy?: string | null; orderTag?: string | null }
) {
  const orderTag = context?.orderTag || orders.find(order => order.tag)?.tag || null
  const strategy = await squareOffStrategy({ strategy: context?.strategy, orderTag })
  const settings = await getRiskSettings()
  const book = resolveSquareOffBook({
    processMock: isMockOrder(),
    strategy,
    settings,
  })
  if (book.action === "refuse") {
    logger.error(`[doDeletePendingOrders] ${book.reason}`)
    return []
  }
  const sessionBlock = liveFlattenSessionBlock({
    paperBook: book.action === "paper",
    marketOpen: isMarketOpen(),
  })
  if (sessionBlock) {
    logger.error(`[doDeletePendingOrders] ${sessionBlock}`)
    return []
  }
  if (book.action === "paper") {
    for (const order of orders) {
      if (!order.tradingsymbol || !order.tag) continue
      await cancelPaperWorkingOrders({ tradingsymbol: order.tradingsymbol, tag: order.tag })
    }
    return []
  }

  const allOrders: KiteOrder[] = await withRemoteRetry(() => kite.getOrders())
  const openOrders: KiteOrder[] = allOrders.filter(order => order.status === STATUS_TRIGGER_PENDING)
  const openOrdersForPositions = orders
    .map(order => openOrders.find(openOrder => protectiveOrderMatchesJob(order, openOrder)))
    .filter((order): order is KiteOrder => Boolean(order))

  return Promise.all(
    openOrdersForPositions.map(async (openOrder: KiteOrder) =>
      withRemoteRetry(() => kite.cancelOrder(openOrder.variety, openOrder.order_id))
    )
  )
}

async function squareOffNet(args: {
  kite: any
  paperBook: boolean
  strategy?: string | null
}): Promise<Array<{ tradingsymbol: string; exchange: string; product: string; quantity: number }>> {
  let kiteNet: Array<{
    tradingsymbol: string
    exchange: string
    product: string
    quantity: number
  }> = []
  let kiteQueried = false
  if (!args.paperBook) {
    try {
      const openPositions = await withRemoteRetry(() => args.kite.getPositions())
      kiteNet = openPositions.net || []
      kiteQueried = true
    } catch (e) {
      logger.warn("[squareOffNet] kite positions unavailable", e)
    }
  }
  const source = squareOffQtySource({
    paperBook: args.paperBook,
    kiteQueried,
    kiteNetLength: kiteNet.filter(p => Number(p.quantity) !== 0).length,
  })
  if (source === "kite") {
    return kiteNet.filter(p => Number(p.quantity) !== 0)
  }
  if (source === "empty") return []
  const rows = ledgerRowsForActiveBook(await getOpenPositions(), {
    paperBook: source === "paper-ledger",
    strategy: args.strategy,
  })
  return rows.map(p => ({
    tradingsymbol: p.tradingsymbol,
    exchange: p.exchange,
    product: p.product || "",
    quantity: p.quantity,
  }))
}

export async function doSquareOffPositions(
  orders: KiteOrder[],
  kite: any,
  initialJobData: Partial<SUPPORTED_TRADE_CONFIG> & { strategy?: string | null }
) {
  const strategy = await squareOffStrategy({
    strategy: initialJobData.strategy,
    orderTag: initialJobData.orderTag,
  })
  const settings = await getRiskSettings()
  const book = resolveSquareOffBook({
    processMock: isMockOrder(),
    strategy,
    settings,
  })
  if (book.action === "refuse") {
    throw new Error(book.reason || SQUARE_OFF_STRATEGY_REQUIRED)
  }
  const paper = book.action === "paper"
  const sessionBlock = liveFlattenSessionBlock({
    paperBook: paper,
    marketOpen: isMarketOpen(),
  })
  if (sessionBlock) {
    throw new Error(sessionBlock || LIVE_FLATTEN_MARKET_CLOSED)
  }
  const net = await squareOffNet({ kite, paperBook: paper, strategy })
  //orders would always have +ve value and filter based on transaction_type
  const openPositionsForOrders = orders
    .filter(o => o)
    .map(order => {
      const position = net.find(
        openPosition =>
          openPosition.tradingsymbol === order.tradingsymbol &&
          openPosition.exchange === order.exchange &&
          openPosition.product === order.product &&
          (openPosition.quantity < 0
            ? // openPosition is short order
              order.transaction_type === "SELL"
            : // long order
              order.transaction_type === "BUY")
      )

      if (!position) {
        return null
      }
      const absquantity: number = Math.min(order.quantity, Math.abs(position.quantity))

      return {
        ...position,
        quantity: position.quantity < 0 ? absquantity * -1 : absquantity,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)

  const remoteRes = await Promise.all(
    openPositionsForOrders.map(async order => {
      const exitOrder = {
        tradingsymbol: order.tradingsymbol,
        quantity: Math.abs(order.quantity),
        exchange: order.exchange,
        transaction_type:
          order.quantity < 0 ? kite.TRANSACTION_TYPE_BUY : kite.TRANSACTION_TYPE_SELL,
        order_type: kite.ORDER_TYPE_MARKET,
        product: order.product,
        tag: initialJobData.orderTag,
        purpose: "FLATTEN",
        strategy,
      }
      // console.log('square off position...', exitOrder)
      return remoteOrderSuccessEnsurer({
        _kite: kite,
        orderProps: exitOrder,
        instrument: (initialJobData as ATM_STRADDLE_TRADE | ATM_STRANGLE_TRADE).instrument!,
        ensureOrderState: kite.STATUS_COMPLETE,
        user: initialJobData.user!,
      })
    })
  )

  if ((initialJobData as ATM_STRANGLE_TRADE | ATM_STRADDLE_TRADE).onSquareOffSetAborted) {
    try {
      await patchDbTrade(initialJobData.id!, {
        userOverride: USER_OVERRIDE.ABORT,
      })
    } catch (error) {
      logger.error("error in onSquareOffSetAborted", error)
    }
  }

  return remoteRes
}

//Squares off the order after checking if the position is open
async function squareOffOrder(order: KiteOrder, kite: any) {
  const strategy = await strategyFromOrderTag(order.tag)
  const settings = await getRiskSettings()
  const book = resolveSquareOffBook({
    processMock: isMockOrder(),
    strategy,
    settings,
  })
  if (book.action === "refuse") {
    throw new Error(book.reason || SQUARE_OFF_STRATEGY_REQUIRED)
  }
  const paper = book.action === "paper"
  const sessionBlock = liveFlattenSessionBlock({
    paperBook: paper,
    marketOpen: isMarketOpen(),
  })
  if (sessionBlock) {
    throw new Error(sessionBlock || LIVE_FLATTEN_MARKET_CLOSED)
  }
  const net = await squareOffNet({ kite, paperBook: paper, strategy })
  const openPositionsforOrders = net.filter(
    position =>
      position.tradingsymbol === order.tradingsymbol &&
      position.exchange === order.exchange &&
      position.product === order.product &&
      (position.quantity < 0
        ? // openPosition is short order
          order.transaction_type === "SELL"
        : // long order
          order.transaction_type === "BUY")
  )

  if (openPositionsforOrders.length === 0) {
    return Promise.resolve("No open positions.")
  }

  const exitOrder = {
    tradingsymbol: order.tradingsymbol,
    quantity: Math.min(order.quantity, Math.abs(openPositionsforOrders[0].quantity)),
    exchange: order.exchange,
    transaction_type:
      order.transaction_type === kite.TRANSACTION_TYPE_SELL
        ? kite.TRANSACTION_TYPE_BUY
        : kite.TRANSACTION_TYPE_SELL,
    order_type: kite.ORDER_TYPE_MARKET,
    product: order.product,
    tag: order.tag,
    purpose: "FLATTEN",
    strategy,
  }
  logger.info(`Placing order ${exitOrder.tradingsymbol} and quantity - ${exitOrder.quantity}`)
  await withRemoteRetry(() => placeOrder(kite, kite.VARIETY_REGULAR, exitOrder as PlaceOrderParams))
}

//Squares off the tag
export async function squareOffTag(
  orderTag: string,
  kite: any,
  { force = false }: { force?: boolean } = {}
): Promise<any> {
  logger.info(`[autoSquareOff] squareOfforders ${orderTag} `)
  const execRows = await db
    .select({ userOverride: jobExecutions.userOverride, strategy: jobExecutions.strategy })
    .from(jobExecutions)
    .where(eq(jobExecutions.orderTag, orderTag))
  if (!force && execRows[0]?.userOverride === USER_OVERRIDE.ABORT) {
    logger.error("Not squaring off as user aborted")
    return "Not squaring off"
  }
  const settings = await getRiskSettings()
  const book = resolveSquareOffBook({
    processMock: isMockOrder(),
    strategy: execRows[0]?.strategy,
    settings,
  })
  if (book.action === "refuse") {
    throw new Error(book.reason || SQUARE_OFF_STRATEGY_REQUIRED)
  }
  const sessionBlock = liveFlattenSessionBlock({
    paperBook: book.action === "paper",
    marketOpen: isMarketOpen(),
  })
  if (sessionBlock) {
    logger.error(`[autoSquareOff] ${sessionBlock}`)
    return sessionBlock
  }
  const orderSummarybyTag = (await getCompletedOrdersbyTag(orderTag, kite)).filter(
    summary => summary.quantity !== 0
  )
  if (book.action === "paper") {
    for (const summary of orderSummarybyTag) {
      if (!summary.tradingsymbol) continue
      await cancelPaperWorkingOrders({ tradingsymbol: summary.tradingsymbol, tag: orderTag })
    }
  }
  const allOrders: KiteOrder[] = await withRemoteRetry(() => kite.getOrders())
  // orderSummarybyTag.filter(summary=>(summary.quantity!=0))
  //                   .forEach(async summary=>
  for (const summary of orderSummarybyTag) {
    if (book.action !== "paper") {
      for (const openOrder of allOrders.filter(
        order =>
          order.status === STATUS_TRIGGER_PENDING &&
          order.tag === orderTag &&
          order.tradingsymbol === summary.tradingsymbol
      )) {
        logger.info(`Cancelling orderId ${openOrder.order_id} ; variety ${openOrder.variety}`)
        await withRemoteRetry(() => kite.cancelOrder(openOrder.variety, openOrder.order_id))
        /*
                        await withRemoteRetry(async () =>
                getInstrumentPrice(kite,current.tradingsymbol, 'NFO'));
                */
        //kite.cancelOrder(openOrder.variety, openOrder.order_id);
      }
    }
    /*allOrders.filter(order => (order.status === 'TRIGGER PENDING' && order.tag === orderTag))
                        .forEach(async (openOrder) => {
                          await withRemoteRetry(() => kite.cancelOrder(openOrder.variety, openOrder.order_id))
                        })*/
    for (const order of allOrders.filter(
      order =>
        order.status === "COMPLETE" &&
        order.tag === orderTag &&
        order.tradingsymbol === summary.tradingsymbol &&
        (summary.quantity > 0
          ? order.transaction_type === "BUY"
          : order.transaction_type === "SELL")
    )) {
      await squareOffOrder(order, kite)
    }
    /*allOrders.filter(order=>
                          (order.status==='COMPLETE' && order.tag===orderTag && order.tradingsymbol===summary.tradingsymbol
                          && (summary.quantity>0?(order.transaction_type==='BUY'):(order.transaction_type==='SELL'))))
                          .forEach(async order=>
                            await squareOffOrder(order,kite))
                            */
  }

  return Promise.resolve("Orders squared off")
}

export async function cancelCoOrders(user): Promise<any> {
  const kite = syncGetKiteInstance(user)
  const allOrders: KiteOrder[] = await withRemoteRetry(() => kite.getOrders())
  const openOrders: KiteOrder[] = allOrders.filter(
    order => order.status === STATUS_TRIGGER_PENDING && order.variety === kite.VARIETY_CO
  )
  await Promise.all(
    openOrders
      .filter(order => order.order_id)
      .map(order => withRemoteRetry(() => kite.cancelOrder(kite.VARIETY_CO, order.order_id!)))
  )
}
/* Squares off the orders */
async function autoSquareOffStrat({
  rawKiteOrdersResponse,
  deletePendingOrders,
  initialJobData,
}: {
  rawKiteOrdersResponse: KiteOrder[]
  deletePendingOrders: boolean
  initialJobData: SUPPORTED_TRADE_CONFIG
}): Promise<any> {
  const { user } = initialJobData
  const kite = syncGetKiteInstance(user)
  const completedOrders = rawKiteOrdersResponse
  const execRows = await db
    .select({ userOverride: jobExecutions.userOverride })
    .from(jobExecutions)
    .where(eq(jobExecutions.id, initialJobData.id!))
  if (execRows[0]?.userOverride === USER_OVERRIDE.ABORT) {
    logger.error("Not squaring off as user aborted")
    return
  }

  const bookStrategy = (initialJobData as { strategy?: string | null }).strategy
  const settings = await getRiskSettings()
  const book = resolveSquareOffBook({
    processMock: isMockOrder(),
    strategy: bookStrategy || (await strategyFromOrderTag(initialJobData.orderTag)),
    settings,
  })
  if (book.action === "refuse") {
    throw new Error(book.reason || SQUARE_OFF_STRATEGY_REQUIRED)
  }
  const sessionBlock = liveFlattenSessionBlock({
    paperBook: book.action === "paper",
    marketOpen: isMarketOpen(),
  })
  if (sessionBlock) {
    logger.error(`[autoSquareOff] ${sessionBlock}`)
    const { recordOperatorAlert } = await import("../trading/alerts")
    await recordOperatorAlert({
      source: "JOB",
      code: "MARKET_CLOSED",
      severity: "ERROR",
      summary: sessionBlock,
      jobId: initialJobData.id ?? null,
      strategy: bookStrategy ?? null,
      instrument:
        typeof (initialJobData as { instrument?: string }).instrument === "string"
          ? (initialJobData as { instrument?: string }).instrument
          : null,
      idempotencyKey: `alert:aso-closed:${initialJobData.id || initialJobData.orderTag}`,
    })
    return sessionBlock
  }

  if (deletePendingOrders) {
    try {
      await doDeletePendingOrders(completedOrders, kite, {
        strategy: bookStrategy,
        orderTag: initialJobData.orderTag,
      })
      // console.log('🟢 deletePendingOrders success', res)
    } catch (e) {
      logger.error("🔴 deletePendingOrders failed")
      logger.error("deletePendingOrders error", e)
    }
  }
  logger.info("Calling SquareOff positions")
  return doSquareOffPositions(completedOrders, kite, initialJobData)
}

export default autoSquareOffStrat
