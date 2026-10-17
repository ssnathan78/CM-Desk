import React from "react"

import "../styles/globals.css"

import CssBaseline from "@mui/material/CssBaseline"

import { ThemeProvider } from "@mui/material/styles"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"

import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"
import Head from "next/head"

import { SWRConfig } from "swr"

import fetch from "../lib/fetchJson"

import theme from "../src/theme"

const fontSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
})

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
})

function MyApp({ Component, pageProps }) {
  return (
    <SWRConfig
      value={{
        fetcher: fetch,

        onError: err => {
          console.error(err)
        },
      }}
    >
      <Head>
        <meta charSet="utf-8" />

        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta
          name="description"
          content="CM-Desk is a personal algorithmic trading app for Indian stock markets"
        />

        <meta name="keywords" content="algo trading, systematic trading, automation, strategies" />

        <title>CM-Desk</title>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <meta name="theme-color" content="#0F1217" />
      </Head>

      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <div className={`${fontSans.variable} ${fontMono.variable}`}>
            <Component {...pageProps} />
          </div>
        </ThemeProvider>
      </LocalizationProvider>
    </SWRConfig>
  )
}

export default MyApp
