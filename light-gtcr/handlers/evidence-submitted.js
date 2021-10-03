const fetch = require('node-fetch')
const delay = require('delay')

const { truncateETHAddress } = require('../../utils/string')
const { ITEM_STATUS } = require('../../utils/enums')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async (_arbitrator, evidenceGroupID, party) => {
  // When someone challenges a request with evidence, two handlers would
  // be dispatched simultaneously (Dispute, Evidence).
  // Which can result in the key not being found depending if the
  // evidence executes faster.
  // We work around this with a simple delay.
  await delay(40 * 1000)

  const subgraphQuery = {
    query: `
      {
        lrequests (where: { evidenceGroupID: "${evidenceGroupID}"}) {
          item {
            itemID
            status
          }
        }
      }
    `
  }
  const response = await fetch(process.env.GTCR_SUBGRAPH_URL, {
    method: 'POST',
    body: JSON.stringify(subgraphQuery)
  })
  const parsedValues = await response.json()
  const itemID = parsedValues.data.lrequests[0].item.itemID

  const { status } = await tcr.getItemInfo(itemID)
  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const shortenedLink = 'TEST' // TODO: REMOVE THIS
  const tweetID = 'tweetIDTether' // TODO: REMOVE THIS
  // const [shortenedLink, tweetID] = await Promise.all([
  //   bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${itemID}`),
  //   db.get(`${network.chainId}-${tcr.address}-${itemID}`)
  // ])

  const message = `New evidence has been submitted by ${truncateETHAddress(
    party
  )} on the ${
    status === ITEM_STATUS.REMOVAL_REQUESTED ? 'removal request' : 'submission'
  } of ${itemName} ${
    status === ITEM_STATUS.REMOVAL_REQUESTED ? 'from the' : 'to the'
  } ${tcrTitle} List.
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
