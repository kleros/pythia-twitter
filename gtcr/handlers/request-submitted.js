const { truncateETHValue } = require('../../utils/string')
const { gtcrDecode } = require('@kleros/gtcr-encoder')

module.exports = ({
  tcr,
  tcrMetaEvidence,
  tcrArbitrableData,
  twitterClient,
  db,
  network
}) => async (_itemID, _submitter, _requestType) => {
  const {
    formattedEthValues: { submissionBaseDeposit }
  } = tcrArbitrableData

  const { data: itemData } = await tcr.getItemInfo(_itemID)
  const decodedData = gtcrDecode({
    columns: tcrMetaEvidence.metadata.columns,
    values: itemData
  })

  console.log("Received a tweet", itemData)
  console.log("Decoded data", decodedData)

  let tweetURL = decodedData[0]
  const hasPhoto = tweetURL.lastIndexOf('/photo') > -1
  if (hasPhoto) tweetURL = tweetURL.slice(0, tweetURL.indexOf('/photo'))
  const hasQueryParam = tweetURL.lastIndexOf('?') > -1
  if (hasQueryParam) tweetURL = tweetURL.slice(0, tweetURL.lastIndexOf('?'))

  const tweetID = tweetURL.slice(tweetURL.lastIndexOf('/') + 1)

  console.log("Tweet ID:", tweetID)

  const depositETH = truncateETHValue(submissionBaseDeposit)
  const message = `Someone accused this tweet of containing false information on Pythia. Verify it for a chance to win ${depositETH} #DAI
          \n\nListing: ${process.env.GTCR_UI_URL}/tcr/100/${tcr.address}/${_itemID}`

  try {
    console.log("Querying tweet")
    const resp = await twitterClient.get('statuses/show', {
      id: tweetID
    })
    console.log("Received tweet", resp)
    console.log("Posting tweet")
    const normalizedTweetID = resp.id_str
    const postResponse = await twitterClient.post('statuses/update', {
      status: message,
      in_reply_to_status_id: normalizedTweetID,
      auto_populate_reply_metadata: true
    })
    console.log("Posted, response:", postResponse)
    await db.put(
      `${network.chainId}-${tcr.address}-${_itemID}`,
      normalizedTweetID
    )
  } catch (err) {
    console.error('Error tweeting')
    console.error(err)
  }
}
