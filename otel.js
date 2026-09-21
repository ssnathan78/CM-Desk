const path = require("path")
require("dotenv").config({ path: path.join(__dirname, ".env.local") })

const { NodeSDK } = require("@opentelemetry/sdk-node")
const { OTLPLogExporter } = require("@opentelemetry/exporter-logs-otlp-http")
const { SimpleLogRecordProcessor } = require("@opentelemetry/sdk-logs")

const sdk = new NodeSDK({
  serviceName: "cm-desk",
  logRecordProcessor: new SimpleLogRecordProcessor(new OTLPLogExporter()),
})

sdk.start()
console.log(
  `[otel] SDK started — endpoint: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "not set"}`
)

// Emit a direct OTEL log record on startup — look for this in Grafana Cloud to confirm the exporter is working.
const { logs } = require("@opentelemetry/api-logs")
const startupLogger = logs.getLogger("cm-desk-startup")
startupLogger.emit({
  severityNumber: 9, // INFO
  severityText: "INFO",
  body: "[otel] cm-desk startup — OTEL log export test",
  attributes: { "service.name": "cm-desk", test: true },
})

process.on("SIGTERM", () => sdk.shutdown().finally(() => process.exit(0)))
