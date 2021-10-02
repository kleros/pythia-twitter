const ethers = require('ethers')
const _LightGeneralizedTCR = require('../../abis/LightGeneralizedTCR.json')

module.exports = ({
  twitterClient,
  db,
  provider,
  arbitrator,
  bitly,
  network
}) => async (_disputeID, _arbitrable) => {
  console.info('appeal decision event')
  const tcr = new ethers.Contract(_arbitrable, _LightGeneralizedTCR, provider)
  const itemID = await tcr.arbitratorDisputeIDToItemID(
    arbitrator.address,
    _disputeID
  )

  const shortenedLink = 'TEST' // TODO: REMOVE THIS
  const tweetID = 'tweetIDTether' // TODO: REMOVE THIS
  // const [shortenedLink, tweetID] = await Promise.all([
  //   bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
  //   db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  // ])

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
