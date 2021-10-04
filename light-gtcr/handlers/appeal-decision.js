const ethers = require('ethers')
const _LightGeneralizedTCR = require('../../abis/LightGeneralizedTCR.json')
const { LGTCRS } = require('../../utils/enums')

module.exports = ({
  twitterClient,
  db,
  provider,
  arbitrator,
  bitly,
  network
}) => async (_disputeID, _arbitrable) => {
  // Detect if this is related to a gtcr instance
  let lgtcrs = {}
  try {
    lgtcrs = JSON.parse(await db.get(LGTCRS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err) // Ignore event.
  }
  if (!lgtcrs[_arbitrable.toLowerCase()]) return // Event not related to a light-gtcr.

  const tcr = new ethers.Contract(_arbitrable, _LightGeneralizedTCR, provider)
  let itemID
  try {
    itemID = await tcr.arbitratorDisputeIDToItemID(
      arbitrator.address,
      Number(_disputeID)
    )
  } catch (err) {
    console.error(
      `Error fetching itemID (AppealDecision), tcrAddr ${
        tcr.address
      }, disputeID ${Number(_disputeID)}, arbitrable ${_arbitrable}`,
      err
    )
    return
  }

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
    db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  ])

  const message = `Ruling appealed! Waiting for evidence and a new ruling.
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
