const ethers = require('ethers')
const _LightGeneralizedTCR = require('../../abis/LightGeneralizedTCR.json')
const { LGTCRS } = require('../../utils/enums')

module.exports = ({
  twitterClient,
  bitly,
  db,
  network,
  provider,
  arbitrator
}) => async (_disputeID, _arbitrable) => {
  // Detect if this is related to a gtcr instance
  let lgtcrs = {}
  try {
    lgtcrs = JSON.parse(await db.get(LGTCRS))
  } catch (err) {
    if (err.type !== 'NotFoundError') throw new Error(err) // Ignore event
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
      `Error fetching itemID (AppealPossible), tcrAddr ${
        tcr.address
      }, disputeID ${Number(_disputeID)}, arbitrable ${_arbitrable}`,
      err
    )
    return
  }

  const shortenedLink = 'TEST' // TODO: REMOVE THIS
  const tweetID = 'tweetIDTether' // TODO: REMOVE THIS
  // const [shortenedLink, tweetID] = await Promise.all([
  //   bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
  //   db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  // ])

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
