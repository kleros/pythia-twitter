const ethers = require('ethers')

const _GTCRFactory = require('@kleros/tcr/build/contracts/GTCRFactory.json')
const _GeneralizedTCR = require('@kleros/tcr/build/contracts/GeneralizedTCR.json')

if (!process.env.PROVIDER_URL)
  throw new Error(
    'No web3 provider set. Please set the PROVIDER_URL environment variable'
  )

if (!process.env.FACTORY_ADDRESS)
  throw new Error(
    'No factory address set. Please set the FACTORY_ADDRESS environment variable'
  )

if (!process.env.BLOCK_TIME_MILLISECONDS)
  throw new Error(
    'No network block time not set. Please set the BLOCK_TIME_MILLISECONDS environment variable'
  )

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL)
provider.pollingInterval = 5 * 60 * 1000 // Poll every 5 minutes.

const gtcrFactory = new ethers.Contract(
  process.env.FACTORY_ADDRESS,
  _GTCRFactory.abi,
  provider
)

;(async () => {
  // Initial setup.
  const currBlock = await provider.getBlockNumber('latest')

  // Fetch logs by scanning the blockchain in batches of 4 months
  // to avoid rate-limiting.
  const blocksPerMinute = Math.floor(
    60 / (process.env.BLOCK_TIME_MILLISECONDS / 1000)
  )
  const blocksPerRequest = blocksPerMinute * 60 * 24 * 30 * 4

  // Fetch the addresses of TCRs deployed with this factory.
  const logPromises = []
  for (let fromBlock = Number(process.env.FACTORY_BLOCK_NUM) || 0; ; ) {
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

  // Add listeners for events emitted by the TCRs.
  tcrs.forEach(tcr => {
    tcr.on(
      tcr.filters.RequestSubmitted(),
      (_itemID, _submitter, _requestType) => {
        // TODO: Tweet about item submitted or removal requested.
        // - Include TCR title in tweet
        // - Include potential reward in tweet.
        // - Include challenge deadline in tweet.
        // - Include link to item in tweet.
        // TODO: Save reference to tweet in db to build threads.
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
  })
})()
