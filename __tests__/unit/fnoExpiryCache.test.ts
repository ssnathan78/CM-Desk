jest.unmock("../../lib/kiteUtils")

const getInstruments = jest.fn()

jest.mock("kiteconnect", () => ({
  KiteConnect: jest.fn().mockImplementation(() => ({
    getInstruments,
  })),
}))

import { getFnOExpiries } from "../../lib/kiteUtils"

const niftyFut = {
  name: "NIFTY",
  instrument_type: "FUT",
  tradingsymbol: "NIFTY26SEPFUT",
  expiry: "2026-09-29",
  lot_size: 65,
}
const bankFut = {
  name: "BANKNIFTY",
  instrument_type: "FUT",
  tradingsymbol: "BANKNIFTY26SEPFUT",
  expiry: "2026-09-29",
  lot_size: 30,
}
const midFut = {
  name: "MIDCPNIFTY",
  instrument_type: "FUT",
  tradingsymbol: "MIDCPNIFTY26SEPFUT",
  expiry: "2026-09-29",
  lot_size: 120,
}
const niftyCe = {
  name: "NIFTY",
  instrument_type: "CE",
  tradingsymbol: "NIFTY26SEP23400CE",
  expiry: "2026-09-24",
  lot_size: 65,
}

describe("getFnOExpiries cache", () => {
  beforeAll(() => {
    process.env.KITE_API_KEY = process.env.KITE_API_KEY || "unit-test-key"
  })

  beforeEach(() => {
    getInstruments.mockReset()
    getInstruments.mockResolvedValue([niftyFut, bankFut, midFut, niftyCe])
  })

  it("keeps a separate list per underlying and instrument type", async () => {
    const nifty = await getFnOExpiries("NIFTY", "FUT")
    const bank = await getFnOExpiries("BANKNIFTY", "FUT")
    const mid = await getFnOExpiries("MIDCPNIFTY", "FUT")
    const calls = await getFnOExpiries("NIFTY", "CE")

    expect(nifty.map(row => row.tradingsymbol)).toEqual(["NIFTY26SEPFUT"])
    expect(bank.map(row => row.tradingsymbol)).toEqual(["BANKNIFTY26SEPFUT"])
    expect(mid.map(row => row.tradingsymbol)).toEqual(["MIDCPNIFTY26SEPFUT"])
    expect(calls.map(row => row.tradingsymbol)).toEqual(["NIFTY26SEP23400CE"])
  })
})
