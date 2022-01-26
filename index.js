const ethers = require('ethers')
const level = require('level')
const Twitter = require('twitter-lite')

const _GeneralizedTCRView = require('./abis/GeneralizedTCRView.json')
const _GeneralizedTCR = require('./abis/GeneralizedTCR.json')

const gtcrBot = require('./gtcr')

const db = level('./db')
let twitterClient
if (
  !!process.env.CONSUMER_KEY &&
  !!process.env.CONSUMER_KEY_SECRET &&
  !!process.env.ACCESS_TOKEN &&
  !!process.env.ACCESS_TOKEN_SECRET
)
  twitterClient = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_KEY_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  })

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL)
provider.pollingInterval = 60 * 1000 // Poll every minute.

const pythia = new ethers.Contract(
  process.env.PYTHIA_ADDRESS,
  _GeneralizedTCR,
  provider
)

const gtcrView = new ethers.Contract(
  process.env.GENERALIZED_TCR_VIEW_ADDRESS,
  _GeneralizedTCRView,
  provider
)

gtcrBot(provider, pythia, twitterClient, gtcrView, db)
