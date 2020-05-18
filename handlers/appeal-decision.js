const ethers = require('ethers')
const _GeneralizedTCR = require('@kleros/tcr/build/contracts/GeneralizedTCR.json')

module.exports = ({
  twitterClient,
  db,
  provider,
  arbitrator,
  bitly,
  network
}) => async (_disputeID, _arbitrable) => {
  const tcr = new ethers.Contract(_arbitrable, _GeneralizedTCR.abi, provider)
  const itemID = await tcr.arbitratorDisputeIDToItem(
    arbitrator.address,
    _disputeID
  )

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
    db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  ])

  const message = `Ruling appealed! Waiting evidence and a new ruling.
    \n\nListing: ${shortenedLink}`

  console.info(message)

  const tweet = await twitterClient.post('statuses/update', {
    status: message,
    in_reply_to_status_id: tweetID,
    auto_populate_reply_metadata: true
  })

  await db.put(`${network.chainId}-${tcr.address}-${itemID}`, tweet.id_str)
}
