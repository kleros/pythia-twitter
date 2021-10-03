const ethers = require('ethers')
const level = require('level')
const Twitter = require('twitter-lite')
const fetch = require('node-fetch')

const _GTCRFactory = require('./abis/GTCRFactory.json')
const _GeneralizedTCRView = require('./abis/GeneralizedTCRView.json')
const _LightGTCRFactory = require('./abis/LightGTCRFactory.json')
const _LightGeneralizedTCRView = require('./abis/LightGeneralizedTCRView.json')

const gtcrBot = require('./gtcr')
const lightGtcrBot = require('./light-gtcr')

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

const lightGtcrFactory = new ethers.Contract(
  process.env.LFACTORY_ADDRESS,
  _LightGTCRFactory,
  provider
)

const lightGtcrView = new ethers.Contract(
  process.env.LGENERALIZED_TCR_VIEW_ADDRESS,
  _LightGeneralizedTCRView,
  provider
)

;(async () => {
  console.info('Instantiating bitly client:', process.env.BITLY_TOKEN)
  // const groupIDResponse = await fetch('https://api-ssl.bitly.com/v4/groups', {
  //   method: 'get',
  //   headers: {
  //     Authorization: `Bearer ${process.env.BITLY_TOKEN}`
  //   }
  // })

  // const groupID = (await groupIDResponse.json()).groups[0].guid
  const groupID = 'Bla2ivZyBPW'
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

  gtcrBot(provider, gtcrFactory, twitterClient, gtcrView, db, bitly)
  lightGtcrBot(
    provider,
    lightGtcrFactory,
    twitterClient,
    lightGtcrView,
    db,
    bitly
  )
})()
