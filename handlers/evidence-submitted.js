const { truncateETHAddress } = require('../utils/string')
const { ITEM_STATUS } = require('../utils/enums')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network,
  provider
}) => async (_arbitrator, evidenceGroupID, party) => {
  const { _itemID: itemID } = (
    await provider.getLogs({
      ...tcr.filters.RequestEvidenceGroupID(null, null, evidenceGroupID),
      fromBlock: 0
    })
  ).map(log => tcr.interface.parseLog(log))[0].values

  const { status } = await tcr.getItemInfo(itemID)
  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
    db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  ])

  const message = `New evidence submitted by ${truncateETHAddress(party)} on ${
    status === ITEM_STATUS.REMOVAL_REQUESTED ? 'removal request' : 'submission'
  } of ${itemName} ${
    status === ITEM_STATUS.REMOVAL_REQUESTED ? 'from' : 'to'
  } ${tcrTitle} TCR.
      \n\nSee Listing: ${shortenedLink}`

  console.info(message)

  const tweet = await twitterClient.post('statuses/update', {
    status: message,
    in_reply_to_status_id: tweetID,
    auto_populate_reply_metadata: true
  })

  await db.put(`${network.chainId}-${tcr.address}-${itemID}`, tweet.id_str)
}
