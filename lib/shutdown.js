async function shutdownWorkers() {
  if (typeof global.__cmDeskCloseWorkers === "function") {
    await global.__cmDeskCloseWorkers()
  }
}

module.exports = { shutdownWorkers }
