const ethers = require('ethers')
const fetch = require('node-fetch')
const { BitlyClient } = require('bitly')
const level = require('level')
const Twitter = require('twitter-lite')

const _GTCRFactory = require('@kleros/tcr/build/contracts/GTCRFactory.json')
const _GeneralizedTCR = require('@kleros/tcr/build/contracts/GeneralizedTCR.json')
const _GeneralizedTCRView = require('@kleros/tcr/build/contracts/GeneralizedTCRView.json')
const _IArbitrator = require('@kleros/tcr/build/contracts/IArbitrator.json')

const { ARBITRATORS } = require('./utils/enums')
const { addTCRListeners, addArbitratorListeners } = require('./handlers')

const {
  utils: { formatEther }
} = ethers

const bitly = new BitlyClient(process.env.BITLY_TOKEN, {})
const db = level('./db')
const twitterClient = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token_key: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET
})

// Run env variable checks.
require('./utils/env-check')

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL)
provider.pollingInterval = 5 * 60 * 1000 // Poll every 5 minutes.

const gtcrFactory = new ethers.Contract(
  process.env.FACTORY_ADDRESS,
  _GTCRFactory.abi,
  provider
)

const gtcrView = new ethers.Contract(
  process.env.GENERALIZED_TCR_VIEW_ADDRESS,
  _GeneralizedTCRView.abi,
  provider
)

// Run bot.
;(async () => {
  // Initial setup.
  console.info('Booting...')
  const [currBlock, network] = await Promise.all([
    provider.getBlockNumber('latest'),
    provider.getNetwork()
  ])
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
    .map(address => new ethers.Contract(address, _GeneralizedTCR.abi, provider))

  // Fetch latest metadata for every tcr.
  console.info('Fetching TCR meta evidence...')
  const tcrMetaEvidences = (
    await Promise.all(
      tcrs.map(async tcr => {
        const logs = (
          await provider.getLogs({
            ...tcr.filters.MetaEvidence(),
            fromBlock: deploymentBlock
          })
        ).map(log => tcr.interface.parseLog(log))
        const { _evidence: metaEvidencePath } = logs[logs.length - 1].values
        const file = await (
          await fetch(process.env.IPFS_GATEWAY + metaEvidencePath)
        ).json()

        // We use a max length limit of item name and TCR title to avoid
        // reaching twitter's char limit.
        const itemName =
          file.metadata.itemName.length > 7 ? 'item' : file.metadata.itemName
        const tcrTitle =
          file.metadata.tcrTitle.length > 11 ? 'a TCR' : file.metadata.tcrTitle
        return {
          tcrAddress: tcr.address,
          file: { ...file, itemName, tcrTitle }
        }
      })
    )
  ).reduce((acc, curr) => ({ ...acc, [curr.tcrAddress]: curr.file }), {})
  console.info('Done.')

  console.info('Fetching TCR contract information...')
  const tcrArbitrableDatas = (
    await Promise.all(
      tcrs.map(async tcr => ({
        tcrAddress: tcr.address,
        data: await gtcrView.fetchArbitrable(tcr.address)
      }))
    )
  )
    .map(arbitrableData => ({
      tcrAddress: arbitrableData.tcrAddress,
      data: {
        ...arbitrableData.data,
        formattedEthValues: {
          // Format wei values to ETH.
          submissionBaseDeposit: formatEther(
            arbitrableData.data.submissionBaseDeposit
          ),
          removalBaseDeposit: formatEther(
            arbitrableData.data.removalBaseDeposit
          ),
          submissionChallengeBaseDeposit: formatEther(
            arbitrableData.data.submissionChallengeBaseDeposit
          ),
          removalChallengeBaseDeposit: formatEther(
            arbitrableData.data.removalChallengeBaseDeposit
          )
        }
      }
    }))
    .reduce((acc, curr) => ({ ...acc, [curr.tcrAddress]: curr.data }), {})
  console.info('Done. Watching for blockchain events.')

  // Add listeners for events emitted by the TCRs.
  for (const tcr of tcrs)
    addTCRListeners({
      tcr,
      tcrMetaEvidence: tcrMetaEvidences[tcr.address],
      tcrArbitrableDatas: tcrArbitrableDatas[tcr.address],
      network,
      bitly,
      twitterClient,
      provider
    })

  // Add arbitrator listeners.
  let arbitrators = {}
  try {
    arbitrators = JSON.parse(await db.get(ARBITRATORS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err)
  }

  Object.keys(arbitrators)
    .map(address => new ethers.Contract(address, _IArbitrator.abi, provider))
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

  // TODO: Watch GTCRFactory for new GTCR instances and add events listeners.
})()
