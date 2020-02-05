const { ITEM_STATUS } = require('../utils/enums')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async (_arbitrator, _disputeID, _ruling) => {
  const itemID = await tcr.arbitratorDisputeIDToItem(_arbitrator, _disputeID)

  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const [shortenedLink, itemInfo, tweetID] = await Promise.all([
    bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
    tcr.getItemInfo(itemID),
    db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  ])
  const { status } = itemInfo

  const message = `${itemName} ${
    status === ITEM_STATUS.REGISTERED ? 'listed on' : 'rejected from'
  } ${tcrTitle}. If you contributed appeal fees to the winner you have claimable rewards.
    \n\nListing: ${shortenedLink.url}`

  const tweet = await twitterClient.post('statuses/update', {
    status: message,
    in_reply_to_status_id: tweetID,
    auto_populate_reply_metadata: true
  })

  await db.put(`${network.chainId}-${tcr.address}-${itemID}`, tweet.data.id_str)
}
