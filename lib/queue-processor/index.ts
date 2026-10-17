import logger from "../logger"
import { startCashScheduler } from "../momentum/scheduler"
import { redisConnection } from "../queue"

type WorkerLike = { close: () => Promise<void> }

const workers: WorkerLike[] = []

declare global {
  // eslint-disable-next-line no-var
  var __cmDeskCloseWorkers: (() => Promise<void>) | undefined
  var __cmDeskBoot: Promise<void> | undefined
}

async function bootWorkers() {
  const { assertMigrationsCurrent } = await import("../migrationGate.js")
  await assertMigrationsCurrent()
  if (workers.length === 0) {
    const mods = await Promise.all([
      import("./tradingQueue"),
      import("./exitTradingQueue"),
      import("./squareOffQueue"),
      import("./ancillaryQueue"),
      import("./targetPnLQueue"),
      import("./chaseQueue"),
    ])
    for (const mod of mods) {
      if (mod.worker) workers.push(mod.worker)
    }
  }
  const { restoreChaseSchedulers } = await import("../queue")
  await restoreChaseSchedulers()
  const { reconcileOpenJobs } = await import("../trading/reconcileJobs")
  await reconcileOpenJobs()
  startCashScheduler()
}

/** Start queue workers once migrations are current. A second copy shares this promise. */
export function startDeskProcess(): Promise<void> {
  if (global.__cmDeskBoot) return global.__cmDeskBoot
  global.__cmDeskBoot = bootWorkers().catch(error => {
    global.__cmDeskBoot = undefined
    logger.error("[boot] workers not started", error)
    throw error
  })
  return global.__cmDeskBoot
}

void startDeskProcess().catch(() => undefined)

export async function closeAllWorkers() {
  await Promise.all(workers.map(worker => worker.close()))
  await redisConnection.quit()
}

global.__cmDeskCloseWorkers = closeAllWorkers
