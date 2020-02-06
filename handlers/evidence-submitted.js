const { truncateETHAddr } = require('../utils/string')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async (_arbitrator, _evidenceGroupID, _party, _evidence) => {
  const { itemID } = await tcr.evidenceGroupIDToRequestID(_evidenceGroupID)
  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
    db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  ])

  const message = `New evidence submitted by ${truncateETHAddr(
    _party
  )} for dispute on ${itemName} of ${tcrTitle} TCR.
      \n\nSee Listing: ${shortenedLink.url}`

  const tweet = await twitterClient.post('statuses/update', {
    status: message,
    in_reply_to_status_id: tweetID,
    auto_populate_reply_metadata: true
  })

  await db.put(`${network.chainId}-${tcr.address}-${itemID}`, tweet.data.id_str)
}
