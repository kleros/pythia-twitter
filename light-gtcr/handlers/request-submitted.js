const fetch = require('node-fetch')
const delay = require('delay')

const { articleFor, truncateETHValue } = require('../../utils/string')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  tcrArbitrableData,
  twitterClient,
  bitly,
  db,
  network
}) => async (_itemID, _evidenceGroupID) => {
  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence
  const {
    formattedEthValues: { submissionBaseDeposit, removalBaseDeposit }
  } = tcrArbitrableData

  const shortenedLink = await bitly.shorten(
    `${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${_itemID}`
  )

  // Wait a bit to ensure subgraph is synced.
  await delay(20 * 1000)
  const subgraphQuery = {
    query: `
      {
        lrequests (where: { evidenceGroupID: "${_evidenceGroupID}"}) {
          requestType
        }
      }
    `
  }
  const response = await fetch(process.env.GTCR_SUBGRAPH_URL, {
    method: 'POST',
    body: JSON.stringify(subgraphQuery)
  })
  const parsedValues = await response.json()
  const requestType = parsedValues.data.lrequests[0].requestType

  const depositETH = truncateETHValue(
    requestType === 'RegistrationRequested'
      ? submissionBaseDeposit
      : removalBaseDeposit
  )
  const message = `Someone ${
    requestType === 'RegistrationRequested'
      ? 'submitted'
      : 'requested the removal of'
  } ${articleFor(itemName)} ${itemName} ${
    requestType === 'RegistrationRequested' ? 'to' : 'from'
  } ${tcrTitle}. Verify it for a chance to win ${depositETH} #ETH
      \n\nListing: ${shortenedLink}`

  console.info(message)

  if (twitterClient) {
    const tweet = await twitterClient.post('statuses/update', {
      status: message
    })

    await db.put(`${network.chainId}-${tcr.address}-${_itemID}`, tweet.id_str)
  }
}
