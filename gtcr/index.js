const { addTCRListeners } = require('./handlers')

/**
 * Starts the twitter bot for Curate Classic events.
 *
 * @param {*} provider The provider to use for interacting with the blockchain.
 * @param {*} pythia The pythia registry contract instance.
 * @param {*} twitterClient The twitter client.
 * @param {*} gtcrView The gtcr view contract instance.
 * @param {*} db The database object.
 * @param {*} bitly Bitly instance to shorten links
 */
async function bot(provider, pythia, twitterClient, gtcrView, db, bitly) {
  // Initial setup.
  console.info('Booting gtcr bots...')
  const network = await provider.getNetwork()

  console.info(`Connected to ${network.name} of chain of ID ${network.chainId}`)
  console.info(`Pythia deployed at ${process.env.PYTHIA_ADDRESS}`)

  const deploymentBlock = Number(process.env.PYTHIA_BLOCK_NUM) || 0

  addTCRListeners({
    tcr: pythia,
    network,
    bitly,
    twitterClient,
    provider,
    deploymentBlock,
    gtcrView,
    db
  })

  console.info()
  console.info('Done. Watching for blockchain events.')
}

module.exports = bot
