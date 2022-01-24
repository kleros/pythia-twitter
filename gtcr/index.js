const ethers = require('ethers')
const fetch = require('node-fetch')
const { gtcrDecode } = require('@kleros/gtcr-encoder')

const { addArbitratorListeners, addTCRListeners } = require('./handlers')
const _IArbitrator = require('../abis/IArbitrator.json')

const { ARBITRATORS } = require('../utils/enums')
const { truncateETHValue } = require('../utils/string')

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

  // DEL
  console.info('fetching item data')
  const itemID =
    '0x344b5ba727a4701e09fd63da3e2987525a5f36df603a801506f37d5bd34282a2'
  const { data: itemData } = await pythia.getItemInfo(itemID)
  console.info(itemData)
  const logs = (
    await provider.getLogs({
      ...pythia.filters.MetaEvidence(),
      fromBlock: Number(process.env.PYTHIA_BLOCK_NUM)
    })
  ).map(log => pythia.interface.parseLog(log))

  const { _evidence: metaEvidencePath } = logs[logs.length - 1].args
  const tcrMetaEvidence = await (
    await fetch(process.env.IPFS_GATEWAY + metaEvidencePath)
  ).json()

  console.info(tcrMetaEvidence)

  const decodedData = gtcrDecode({
    columns: tcrMetaEvidence.metadata.columns,
    values: itemData
  })

  const tweetURL = decodedData[0]
  const tweetID = tweetURL.slice(
    tweetURL.lastIndexOf('/') + 1,
    tweetURL.lastIndexOf('?')
  )

  const shortenedLink = await bitly.shorten(
    `${process.env.GTCR_UI_URL}/tcr/${pythia.address}/${itemID}?chainId=100`
  )

  // const depositETH = truncateETHValue(submissionBaseDeposit)
  const message = `Someone accused this tweet of containing false information on Pythia. Verify it for a chance to win 30 #DAI
      \n\nListing: ${shortenedLink}`

  console.info(message)

  try {
    const tweet = await twitterClient.post('statuses/update', {
      status: message,
      in_reply_to_status_id: tweetID,
      auto_populate_reply_metadata: true
    })
    console.info('tweeting', message)
  } catch (error) {
    console.error(error)
  }

  // END-DEL

  // // Add arbitrator listeners.
  // let arbitrators = {}
  // try {
  //   arbitrators = JSON.parse(await db.get(ARBITRATORS))
  // } catch (err) {
  //   if (err.type !== 'NotFoundError') throw new Error(err)
  // }

  // Object.keys(arbitrators)
  //   .map(address => new ethers.Contract(address, _IArbitrator, provider))
  //   .forEach(arbitrator =>
  //     addArbitratorListeners({
  //       arbitrator,
  //       twitterClient,
  //       bitly,
  //       db,
  //       network,
  //       provider
  //     })
  //   )

  const deploymentBlock = Number(process.env.PYTHIA_BLOCK_NUM) || 0

  // addTCRListeners({
  //   tcr: pythia,
  //   network,
  //   bitly,
  //   twitterClient,
  //   provider,
  //   deploymentBlock,
  //   gtcrView,
  //   db
  // })

  console.info()
  console.info('Done. Watching for blockchain events.')
}

module.exports = bot
