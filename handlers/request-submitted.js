const { articleFor, truncateETH } = require('../utils/string')
const { ITEM_STATUS } = require('../utils/enums')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  tcrArbitrableData,
  twitterClient,
  bitly,
  db,
  network
}) => async (_itemID, _submitter, _requestType) => {
  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence
  const {
    formattedEthValues: { submissionBaseDeposit, removalBaseDeposit }
  } = tcrArbitrableData

  const shortenedLink = await bitly.shorten(
    `${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${_itemID}`
  )

  const depositETH = truncateETH(
    _requestType === ITEM_STATUS.SUBMITTED
      ? submissionBaseDeposit
      : removalBaseDeposit
  )
  const message = `Someone ${
    _requestType === ITEM_STATUS.SUBMITTED
      ? 'submitted'
      : 'requested the removal of'
  } ${articleFor(itemName)} ${itemName} ${
    _requestType === ITEM_STATUS.SUBMITTED ? 'to' : 'from'
  } ${tcrTitle}. Verify it for a chance to win ${depositETH} #ETH
      \n\nListing: ${shortenedLink.url}`

  const tweet = await twitterClient.post('statuses/update', {
    status: message
  })

  await db.put(
    `${network.chainId}-${tcr.address}-${_itemID}`,
    tweet.data.id_str
  )
}
