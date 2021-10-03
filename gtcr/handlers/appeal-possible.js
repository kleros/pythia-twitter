const ethers = require('ethers')
const _GeneralizedTCR = require('../../abis/GeneralizedTCR.json')
const { GTCRS } = require('../../utils/enums')

module.exports = ({
  twitterClient,
  bitly,
  db,
  network,
  provider,
  arbitrator
}) => async (_disputeID, _arbitrable) => {
  // Detect if this is related to a gtcr instance
  let gtcrs = {}
  try {
    gtcrs = JSON.parse(await db.get(GTCRS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err) // Ignore event
  }
  if (!gtcrs[_arbitrable.toLowerCase()]) return // Event not related to a gtcr.

  const tcr = new ethers.Contract(_arbitrable, _GeneralizedTCR, provider)
  const itemID = await tcr.arbitratorDisputeIDToItem(
    arbitrator.address,
    Number(_disputeID)
  )

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
    db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  ])

  const message = `The arbitrator gave an appealable ruling. Think it is incorrect? Contribute appeal fees for a chance to earn the opponent's stake!
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
