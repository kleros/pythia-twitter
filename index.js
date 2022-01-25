const ethers = require('ethers')
const level = require('level')
const Twitter = require('twitter-lite')
const fetch = require('node-fetch')

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

;(async () => {
  console.info('Instantiating bitly client:', process.env.BITLY_TOKEN)
  const groupIDResponse = await fetch('https://api-ssl.bitly.com/v4/groups', {
    method: 'get',
    headers: {
      Authorization: `Bearer ${process.env.BITLY_TOKEN}`
    }
  })

  const groupID = (await groupIDResponse.json()).groups[0].guid
  console.info(`Got bitly groupID ${groupID}`)

  const bitly = {
    shorten: async url =>
      `https://${
        (
          await (
            await fetch('https://api-ssl.bitly.com/v4/shorten', {
              method: 'post',
              headers: {
                Authorization: `Bearer ${process.env.BITLY_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                long_url: url,
                group_guid: groupID
              })
            })
          ).json()
        ).id
      }`
  }

  gtcrBot(provider, pythia, twitterClient, gtcrView, db, bitly)
})()
