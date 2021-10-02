const fetch = require('node-fetch')
const delay = require('delay')

const { ITEM_STATUS } = require('../../utils/enums')
const { capitalizeFirstLetter } = require('../../utils/string')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  twitterClient,
  bitly,
  db,
  network
}) => async _itemID => {
  // Wait a bit to ensure subgraph is synced.
  await delay(20 * 1000)

  const subgraphQuery = {
    query: `
      {
        litem (id: "${_itemID}@${tcr.address.toLowerCase()}") {
          requests {
            disputed
            resolved
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
  const { disputed, resolved } = parsedValues.data.litem.requests[0]

  if (disputed || !resolved) return // Only handle request executed here.

  const {
    metadata: { itemName, tcrTitle }
  } = tcrMetaEvidence

  const itemInfo = await tcr.getItemInfo(_itemID)

  const shortenedLink = 'TEST' // TODO: REMOVE THIS
  const tweetID = 'tweetIDTether' // TODO: REMOVE THIS
  // const [shortenedLink, tweetID] = await Promise.all([
  //   bitly.shorten(`${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${_itemID}`),
  //   db.get(`${network.chainId}-${tcr.address}-${_itemID}`)
  // ])

  const { status } = itemInfo
  const message = `${
    status === ITEM_STATUS.REGISTERED
      ? `${capitalizeFirstLetter(itemName)} accepted into the`
      : `${capitalizeFirstLetter(itemName)} removed from the`
  } ${tcrTitle} List.
    \n\nListing: ${shortenedLink}`

  console.info(message)

  if (twitterClient) {
    const tweet = await twitterClient.post('statuses/update', {
      status: message,
      in_reply_to_status_id: tweetID,
      auto_populate_reply_metadata: true
    })

    await db.put(`${network.chainId}-${tcr.address}-${_itemID}`, tweet.id_str)
  }
}
