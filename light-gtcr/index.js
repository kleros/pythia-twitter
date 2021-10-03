const ethers = require('ethers')

const { addArbitratorListeners, addTCRListeners } = require('./handlers')
const _LightGeneralizedTCR = require('../abis/LightGeneralizedTCR.json')
const _IArbitrator = require('../abis/IArbitrator.json')

const { ARBITRATORS } = require('../utils/enums')

/**
 * Starts the twitter bot for Light Curate events.
 *
 * @param {*} provider The provider to use for interacting with the blockchain.
 * @param {*} lightGtcrFactory The light gtcr factory contract instance.
 * @param {*} twitterClient The twitter client.
 * @param {*} lightGtcrView The light gtcr view contract instance.
 * @param {*} db The database object.
 * @param {*} bitly Bitly instance to shorten links
 */
async function bot(
  provider,
  lightGtcrFactory,
  twitterClient,
  lightGtcrView,
  db,
  bitly
) {
  // Initial setup.
  console.info('Booting Light GTCR bots...')
  const [currBlock, network] = await Promise.all([
    provider.getBlockNumber('latest'),
    provider.getNetwork()
  ])

  console.info(`Connected to ${network.name} of chain of ID ${network.chainId}`)
  console.info(`Light GTCR Factory deployed at ${lightGtcrFactory.address}`)

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
  const deploymentBlock = Number(process.env.LFACTORY_BLOCK_NUM) || 0

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
        ...lightGtcrFactory.filters.NewGTCR(),
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
    .map(log => lightGtcrFactory.interface.parseLog(log).values._address)
    .map(
      address => new ethers.Contract(address, _LightGeneralizedTCR, provider)
    )

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
        lightGtcrView,
        db
      })
    )
  )

  // Watch for new TCRs and add listeners.
  lightGtcrFactory.on(lightGtcrFactory.filters.NewGTCR(), _address =>
    addTCRListeners({
      tcr: new ethers.Contract(_address, _LightGeneralizedTCR, provider),
      network,
      deploymentBlock,
      bitly,
      twitterClient,
      provider,
      lightGtcrView,
      db
    })
  )

  console.info()
  console.info('Done. Watching for blockchain events.')
}

module.exports = bot
