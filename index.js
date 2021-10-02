const ethers = require('ethers')
const level = require('level')
const Twitter = require('twitter-lite')
const fetch = require('node-fetch')

const _GTCRFactory = require('./abis/GTCRFactory.json')
const _GeneralizedTCR = require('./abis/GeneralizedTCR.json')
const _GeneralizedTCRView = require('./abis/GeneralizedTCRView.json')
const _IArbitrator = require('./abis/IArbitrator.json')

const { ARBITRATORS } = require('./utils/enums')
const { addTCRListeners, addArbitratorListeners } = require('./gtcr-handlers')

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

// Run bot.
;(async () => {
  // Initial setup.
  console.info('Booting...')
  console.info()
  const [currBlock, network, groupIDResponse] = await Promise.all([
    provider.getBlockNumber('latest'),
    provider.getNetwork(),
    fetch('https://api-ssl.bitly.com/v4/groups', {
      method: 'get',
      headers: {
        Authorization: `Bearer ${process.env.BITLY_TOKEN}`
      }
    })
  ])
  const groupID = (await groupIDResponse.json()).groups[0].guid
  console.info('Got bitly groupID')

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

  console.info(`Connected to ${network.name} of chain of ID ${network.chainId}`)
  console.info(`GTCR Factory deployed at ${process.env.FACTORY_ADDRESS}`)

  // Add arbitrator listeners.
  let arbitrators = {}
  try {
    arbitrators = JSON.parse(await db.get(ARBITRATORS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err)
  }

  Object.keys(arbitrators)
    .map(address => new ethers.Contract(address, _IArbitrator, provider))
    .forEach(arbitrator =>
      addArbitratorListeners({
        arbitrator,
        twitterClient,
        bitly,
        db,
        network,
        provider
      })
    )

  // Fetch all TCR addresses from factory logs, instantiate and add
  // event listeners.
  const deploymentBlock = Number(process.env.FACTORY_BLOCK_NUM) || 0

  // Fetch logs by scanning the blockchain in batches of 4 months
  // to avoid rate-limiting.
  const blocksPerMinute = Math.floor(
    60 / (process.env.BLOCK_TIME_MILLISECONDS / 1000)
  )
  const blocksPerRequest = blocksPerMinute * 60 * 24 * 30 * 4

  // Fetch the addresses of TCRs deployed with this factory.
  const logPromises = []
  for (let fromBlock = deploymentBlock; ; ) {
    logPromises.push(
      provider.getLogs({
        ...gtcrFactory.filters.NewGTCR(),
        fromBlock: fromBlock,
        toBlock: fromBlock + blocksPerRequest
      })
    )

    if (fromBlock + blocksPerRequest >= currBlock) break
    fromBlock += blocksPerRequest
  }

  // Concat results and instantiate TCRs.
  const tcrs = (await Promise.all(logPromises))
    .reduce((acc, curr) => acc.concat(curr), [])
    .map(log => gtcrFactory.interface.parseLog(log).values._address)
    .map(address => new ethers.Contract(address, _GeneralizedTCR, provider))

  // Add listeners for events emitted by the TCRs.
  await Promise.all(
    tcrs.map(tcr =>
      addTCRListeners({
        tcr,
        network,
        bitly,
        twitterClient,
        provider,
        deploymentBlock,
        gtcrView,
        db
      })
    )
  )

  // Watch for new TCRs and add listeners.
  gtcrFactory.on(gtcrFactory.filters.NewGTCR(), _address =>
    addTCRListeners({
      tcr: new ethers.Contract(_address, _GeneralizedTCR, provider),
      network,
      deploymentBlock,
      bitly,
      twitterClient,
      provider,
      gtcrView,
      db
    })
  )

  console.info()
  console.info('Done. Watching for blockchain events.')
})()
