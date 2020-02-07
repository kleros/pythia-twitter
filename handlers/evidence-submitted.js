const { truncateETHAddress } = require('../utils/string')
const { ITEM_STATUS } = require('../utils/enums')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async (_arbitrator, _evidenceGroupID, _party, _evidence) => {
  const { itemID } = await tcr.evidenceGroupIDToRequestID(_evidenceGroupID)
  const { status } = await tcr.getItemInfo(itemID)
  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
    db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  ])

  const message = `New evidence submitted by ${truncateETHAddress(_party)} on ${
    status === ITEM_STATUS.REMOVAL_REQUESTED ? 'removal request' : 'submission'
  } of ${itemName} of ${tcrTitle} TCR.
      \n\nSee Listing: ${shortenedLink.url}`

  const tweet = await twitterClient.post('statuses/update', {
    status: message,
    in_reply_to_status_id: tweetID,
    auto_populate_reply_metadata: true
  })

  await db.put(`${network.chainId}-${tcr.address}-${itemID}`, tweet.id_str)
}
