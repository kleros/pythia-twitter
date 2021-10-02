const _IArbitrator = require('../abis/IArbitrator.json')
const ethers = require('ethers')

const { ITEM_STATUS, ARBITRATORS } = require('../utils/enums')
const { truncateETHValue, articleFor } = require('../utils/string')
const appealPossibleHandler = require('./appeal-possible')
const appealDecisionHandler = require('./appeal-decision')

const {
  utils: { getAddress }
} = ethers

module.exports = ({
  tcr,
  tcrMetaEvidence,
  tcrArbitrableData,
  twitterClient,
  bitly,
  db,
  network,
  provider
}) => async (arbitratorAddress, disputeID) => {
  const itemID = await tcr.arbitratorDisputeIDToItem(
    arbitratorAddress,
    disputeID
  )

  const {
    metadata: { itemName }
  } = tcrMetaEvidence
  const {
    formattedEthValues: {
      submissionBaseDeposit,
      submissionChallengeBaseDeposit,
      removalBaseDeposit,
      removalChallengeBaseDeposit
    }
  } = tcrArbitrableData

  const [shortenedLink, itemInfo, tweetID] = await Promise.all([
    bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
    tcr.getItemInfo(itemID),
    db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  ])
  const { status } = itemInfo
  const ethAmount =
    status === ITEM_STATUS.SUBMITTED
      ? Number(submissionBaseDeposit) + Number(submissionChallengeBaseDeposit)
      : Number(removalBaseDeposit) + Number(removalChallengeBaseDeposit)

  const message = `Challenge! ${articleFor(
    itemName
  ).toUpperCase()} ${itemName} ${
    status === ITEM_STATUS.SUBMITTED ? 'submission' : 'removal'
  } headed to court!
      \n\nA total of ${truncateETHValue(ethAmount)} #ETH is at stake.
      \n\nListing: ${shortenedLink}`

  if (twitterClient) {
    const tweet = await twitterClient.post('statuses/update', {
      status: message,
      in_reply_to_status_id: tweetID,
      auto_populate_reply_metadata: true
    })

    await db.put(`${network.chainId}-${tcr.address}-${itemID}`, tweet.id_str)
  }

  const checksummedArbitratorAddr = getAddress(arbitratorAddress)
  let arbitrators = {}
  try {
    arbitrators = JSON.parse(await db.get(ARBITRATORS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err)
  }

  if (!arbitrators[checksummedArbitratorAddr]) {
    // Add a listener for this arbitrator if there isn't one yet.
    const arbitrator = new ethers.Contract(
      checksummedArbitratorAddr,
      _IArbitrator,
      provider
    )

    arbitrator.on(
      arbitrator.filters.AppealPossible(),
      appealPossibleHandler({
        tcrMetaEvidence,
        twitterClient,
        bitly,
        db,
        network,
        provider,
        arbitrator
      })
    )
    arbitrator.on(
      arbitrator.filters.AppealDecision(),
      appealDecisionHandler({
        twitterClient,
        db,
        provider,
        arbitrator,
        bitly,
        network
      })
    )
    arbitrators[checksummedArbitratorAddr] = true

    await db.put(ARBITRATORS, JSON.stringify(arbitrators))
    console.info(`
      Listeners setup for arbitrator at ${checksummedArbitratorAddr}
    `)
  }
}
