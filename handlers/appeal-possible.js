const ethers = require('ethers')
const _GeneralizedTCR = require('@kleros/tcr/build/contracts/GeneralizedTCR.json')

const { articleFor } = require('../utils/string')

module.exports = ({
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network,
  provider,
  arbitrator
}) => async (_disputeID, _arbitrable) => {
  const tcr = new ethers.Contract(_arbitrable, _GeneralizedTCR.abi, provider)
  const itemID = await tcr.arbitratorDisputeIDToItem(
    arbitrator.address,
    _disputeID
  )
  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const [shortenedLink, tweetID] = await Promise.all([
    bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
    db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  ])

  const message = `The arbitrator gave an appealable ruling on ${articleFor} ${articleFor(
    itemName
  )} ${itemName} of the ${tcrTitle} TCR. Think the ruling is incorrect? Contribute appeal fees for a chance to earn the opponent's stake!
    \n\nListing: ${shortenedLink.url}`

  const tweet = await twitterClient.post('statuses/update', {
    status: message,
    in_reply_to_status_id: tweetID,
    auto_populate_reply_metadata: true
  })

  await db.put(`${network.chainId}-${tcr.address}-${itemID}`, tweet.id_str)
}
