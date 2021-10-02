const ethers = require('ethers')
const level = require('level')
const Twitter = require('twitter-lite')

const _GTCRFactory = require('./abis/GTCRFactory.json')
const _GeneralizedTCRView = require('./abis/GeneralizedTCRView.json')

const gtcrBot = require('./gtcr')

const db = level('./db')
let twitterClient
if (
  !!process.env.CONSUMER_KEY &&
  !!process.env.CONSUMER_SECRET &&
  !!process.env.ACCESS_TOKEN &&
  !!process.env.ACCESS_TOKEN_SECRET
)
  twitterClient = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  })

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL)
provider.pollingInterval = 60 * 1000 // Poll every minute.

const gtcrFactory = new ethers.Contract(
  process.env.FACTORY_ADDRESS,
  _GTCRFactory,
  provider
)

const gtcrView = new ethers.Contract(
  process.env.GENERALIZED_TCR_VIEW_ADDRESS,
  _GeneralizedTCRView,
  provider
)

gtcrBot(provider, gtcrFactory, twitterClient, gtcrView, db)
