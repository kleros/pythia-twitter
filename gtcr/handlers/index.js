const fetch = require('node-fetch')
const ethers = require('ethers')

const requestSubmittedHandler = require('./request-submitted')

const {
  utils: { formatEther }
} = ethers

/**
 * Add listeners to tweet on important TCR events. Additionally, adds arbitrator listeners in case of a dispute, if there isn't one already.
 *
 * @param {object} args An object with listener parameters.
 * @param {object} args.tcr The TCR contract instance.
 * @param {object} args.gtcrView The view contract to batch TCR queries.
 * @param {object} args.deploymentBlock The TCR contract instance.
 * @param {object} args.network The network object. Used to not mix content from different chains on the database.
 * @param {object} args.bitly Bitly client instance. Used to short links to save chars on tweet.
 * @param {object} args.twitterClient The twitter client instance.
 * @param {object} args.db The level instance. Used to track tweets for replies and arbitrator listeners.
 * @param {object} args.provider The web3 provider.
 */
async function addTCRListeners({
  tcr,
  network,
  bitly,
  gtcrView,
  twitterClient,
  deploymentBlock,
  db,
  provider
}) {
  console.info(`Fetching meta evidence and TCR data of TCR at ${tcr.address}`)

  // Fetch meta evidence.
  const logs = (
    await provider.getLogs({
      ...tcr.filters.MetaEvidence(),
      fromBlock: deploymentBlock
    })
  ).map(log => tcr.interface.parseLog(log))

  const { _evidence: metaEvidencePath } = logs[logs.length - 1].args
  const tcrMetaEvidence = await (
    await fetch(process.env.IPFS_GATEWAY + metaEvidencePath)
  ).json()

  // Fetch TCR data.
  const data = await gtcrView.fetchArbitrable(tcr.address)
  const tcrArbitrableData = {
    ...data,
    formattedEthValues: {
      // Format wei values to ETH.
      submissionBaseDeposit: formatEther(data.submissionBaseDeposit),
      removalBaseDeposit: formatEther(data.removalBaseDeposit),
      submissionChallengeBaseDeposit: formatEther(
        data.submissionChallengeBaseDeposit
      ),
      removalChallengeBaseDeposit: formatEther(data.removalChallengeBaseDeposit)
    }
  }

  // Submissions and removal requests.
  tcr.on(
    tcr.filters.RequestSubmitted(),
    requestSubmittedHandler({
      tcr,
      tcrMetaEvidence,
      tcrArbitrableData,
      twitterClient,
      bitly,
      db,
      network,
      provider
    })
  )

  console.info(`Done fetching and setting up listeners for ${tcr.address}`)
}

module.exports = {
  addTCRListeners
}
