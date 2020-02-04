const ethers = require('ethers')
const fetch = require('node-fetch')
const { BitlyClient } = require('bitly')
const level = require('level')
const Twitter = require('twitter-lite')

const _GTCRFactory = require('@kleros/tcr/build/contracts/GTCRFactory.json')
const _GeneralizedTCR = require('@kleros/tcr/build/contracts/GeneralizedTCR.json')
const _GeneralizedTCRView = require('@kleros/tcr/build/contracts/GeneralizedTCRView.json')
const { articleFor } = require('./utils/string')
const { ITEM_STATUS } = require('./utils/enums')

const {
  utils: { formatEther }
} = ethers

const bitly = new BitlyClient(process.env.BITLY_TOKEN, {})
const db = level('./db')
const twitterClient = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
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
        return { tcrAddress: tcr.address, file }
      })
    )
  ).reduce((acc, curr) => ({ ...acc, [curr.tcrAddress]: curr.file }), {})
  console.info('Done.')
  console.info()

  console.info('Fetching TCR contract information...')
  const tcrArbitrableData = (
    await Promise.all(
      tcrs.map(async tcr => ({
        tcrAddress: tcr.address,
        data: await gtcrView.fetchArbitrable(tcr.address)
      }))
    )
  ).reduce((acc, curr) => ({ ...acc, [curr.tcrAddress]: curr.file }), {})
  console.info('Done.')
  console.info()

  // Add listeners for events emitted by the TCRs.
  for (const tcr of tcrs) {
    tcr.on(
      tcr.filters.RequestSubmitted(),
      async (_itemID, _submitter, _requestType) => {
        const { metadata } = tcrMetaEvidences[tcr.address]
        const itemName =
          metadata.itemName.length > 7 ? 'item' : metadata.itemName
        const tcrTitle =
          metadata.tcrTitle.length > 11 ? 'a TCR' : metadata.tcrTitle
        const submissionBaseDeposit = formatEther(
          tcrArbitrableData[tcr.address].submissionBaseDeposit
        )
        const shortenedLink = await bitly.shorten(
          `${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${_itemID}`
        )

        const statusId = await db.get(
          `${network.chainId}-${tcr.address}-${_itemID}`
        )

        const message = `Someone ${
          _requestType === ITEM_STATUS.SUBMITTED
            ? 'submitted'
            : 'requested the removal of'
        } ${articleFor(itemName)} ${itemName} ${
          _requestType === ITEM_STATUS.SUBMITTED ? 'to' : 'from'
        } ${tcrTitle}. Verify it for a chance to win ${submissionBaseDeposit} #ETH
          \n\nListing: ${shortenedLink.url}`

        const tweet = await twitterClient.post('statuses/update', {
          status: message,
          in_reply_to_status_id: statusId,
          auto_populate_reply_metadata: true
        })

        // TODO: Save thread ID in DB.
        await db.put(
          `${network.chainId}-${tcr.address}-${_itemID}`,
          tweet.data.id_str
        )
      }
    )

    tcr.on(
      tcr.filters.Dispute(),
      (_arbitrator, _disputeID, _metaEvidenceID, _evidenceGroupID) => {
        // TODO: Fetch reference to tweet in db add reply.
        // TODO: Tweet about item challenged
        // TODO: Add arbitrator listeners for
        // - AppealPossible
        // - AppealDecision
      }
    )

    tcr.on(
      tcr.filters.ItemStatusChange(),
      (_itemID, _requestIndex, _roundIndex, _disputed, _resolved) => {
        // eslint-disable-next-line no-useless-return
        if (_disputed || !_resolved) return // Only handle final status changes.

        // TODO: Fetch reference to tweet in db add reply.
        // TODO: Tweet about request executed without challenges.
      }
    )

    tcr.on(tcr.filters.Ruling(), (_arbitrator, _disputeID, _ruling) => {
      // TODO: Fetch reference to tweet in db add reply.
      // TODO: Tweet about final ruling.
    })

    tcr.on(
      tcr.filters.Evidence(),
      (_arbitrator, _evidenceGroupID, _party, _evidence) => {
        // TODO: Fetch reference to tweet in db add reply.
        // TODO: Tweet aboout new evidence.
      }
    )
  }
})()
