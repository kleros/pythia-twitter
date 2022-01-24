const { truncateETHValue } = require('../../utils/string')
const { ITEM_STATUS } = require('../../utils/enums')
const { gtcrDecode } = require('@kleros/gtcr-encoder')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  tcrArbitrableData,
  twitterClient,
  bitly,
  db,
  network
}) => async (_itemID, _submitter, _requestType) => {
  const {
    formattedEthValues: { submissionBaseDeposit, removalBaseDeposit }
  } = tcrArbitrableData

  const { data: itemData } = await tcr.getItemInfo(_itemID)
  const decodedData = gtcrDecode({
    columns: tcrMetaEvidence.metadata.columns,
    values: itemData
  })
  const tweetURL = decodedData[0]
  const tweetID = tweetURL.slice(
    tweetURL.lastIndexOf('/') + 1,
    tweetURL.lastIndexOf('?')
  )

  const shortenedLink = await bitly.shorten(
    `${process.env.GTCR_UI_URL}/tcr/${tcr.address}/${_itemID}?chainId=100`
  )

  const depositETH = truncateETHValue(
    _requestType === ITEM_STATUS.SUBMITTED
      ? submissionBaseDeposit
      : removalBaseDeposit
  )
  const message = `Someone accused this tweet of containing false information on Pythia. Verify it for a chance to win ${depositETH} #DAI
      \n\nListing: ${shortenedLink}`

  console.info(message)

  if (twitterClient) {
    const tweet = await twitterClient.post('statuses/update', {
      status: message,
      in_reply_to_status_id: tweetID,
      auto_populate_reply_metadata: true
    })
    console.info('tweeting', message)

    await db.put(`${network.chainId}-${tcr.address}-${_itemID}`, tweet.id_str)
  }
}
