const { PARTY } = require('../../utils/enums')

module.exports = ({ tcr, twitterClient, bitly, db, network }) => async (
  itemID,
  _request,
  _round,
  side
) => {
  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
    db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  ])

  const message = `The ${
    side === PARTY.REQUESTER ? 'submitter' : 'challenger'
  } is fully funded. The ${
    side === PARTY.REQUESTER ? 'challenger' : 'submitter'
  } must fully fund before the deadline in order to not lose the case.
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
