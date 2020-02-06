const _IArbitrator = require('@kleros/tcr/build/contracts/IArbitrator.json')
const ethers = require('ethers')

const { ITEM_STATUS } = require('../utils/enums')
const { truncateETHValue } = require('./utils/string')
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
  arbitrators,
  provider
}) => async (_arbitrator, _disputeID, _metaEvidenceID, _evidenceGroupID) => {
  const itemID = await tcr.arbitratorDisputeIDToItem(_arbitrator, _disputeID)

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

  const message = `${itemName} ${
    status === ITEM_STATUS.SUBMITTED ? 'submission' : 'removal'
  } headed to court!
      \n\nA total of ${truncateETHValue(ethAmount)} #ETH is at stake.
      \n\nListing: ${shortenedLink.url}`

  const tweet = await twitterClient.post('statuses/update', {
    status: message,
    in_reply_to_status_id: tweetID,
    auto_populate_reply_metadata: true
  })

  await db.put(`${network.chainId}-${tcr.address}-${itemID}`, tweet.data.id_str)

  const checksummedArbitratorAddr = getAddress(_arbitrator)
  if (!arbitrators[checksummedArbitratorAddr]) {
    // Add a listener for this arbitrator if there isn't one yet.
    const arbitrator = new ethers.Contract(
      checksummedArbitratorAddr,
      _IArbitrator.abi,
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
    arbitrators[checksummedArbitratorAddr] = arbitrator
  }
}
