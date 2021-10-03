const { ITEM_STATUS } = require('../../utils/enums')
const { capitalizeFirstLetter } = require('../../utils/string')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async (_arbitrator, _disputeID, _ruling) => {
  const itemID = await tcr.arbitratorDisputeIDToItemID(_arbitrator, _disputeID)

  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const shortenedLink = 'TEST' // TODO: REMOVE THIS
  const tweetID = 'tweetIDTether' // TODO: REMOVE THIS
  // const [shortenedLink, tweetID] = await Promise.all([
  //   bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
  //   db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  // ])

  const itemInfo = await tcr.getItemInfo(itemID)
  const { status } = itemInfo
  const message = `${capitalizeFirstLetter(itemName)} ${
    status === ITEM_STATUS.REGISTERED ? 'listed on' : 'rejected from'
  } ${tcrTitle}. If you contributed appeal fees to the winner you may have claimable rewards.
    \n\nListing: ${shortenedLink}`

  console.info(message)

  if (twitterClient) {
    const tweet = await twitterClient.post('statuses/update', {
      status: message,
      in_reply_to_status_id: tweetID,
      auto_populate_reply_metadata: true
    })

    await db.put(`${network.chainId}-${tcr.address}-${itemID}`, tweet.id_str)
  }
}
