// Twitter
if (!process.env.CONSUMER_KEY) {
  console.error(
    'Twitter consumer key not set. Please set the CONSUMER_KEY environment variable'
  )
  process.exit(1)
}

if (!process.env.CONSUMER_SECRET) {
  console.error(
    'Twitter consumer secret not set. Please set the CONSUMER_SECRET environment variable'
  )
  process.exit(1)
}

if (!process.env.ACCESS_TOKEN) {
  console.error(
    'Twitter access token not set. Please set the ACCESS_TOKEN environment variable'
  )
  process.exit(1)
}

if (!process.env.ACCESS_TOKEN_SECRET) {
  console.error(
    'Twitter access token secret not set. Please set the ACCESS_TOKEN_SECRET environment variable'
  )
  process.exit(1)
}

// Bitly
if (!process.env.BITLY_TOKEN) {
  console.error(
    'Bitly link shortner token found. Please set the BITLY_TOKEN environment variable'
  )
  process.exit(1)
}

// Web3
if (!process.env.PROVIDER_URL) {
  console.error(
    'No web3 provider set. Please set the PROVIDER_URL environment variable'
  )
  process.exit(1)
}

if (!process.env.FACTORY_ADDRESS) {
  console.error(
    'No factory address set. Please set the FACTORY_ADDRESS environment variable'
  )
  process.exit(1)
}

if (!process.env.GENERALIZED_TCR_VIEW_ADDRESS) {
  console.error(
    'View contract address not set. Please set the GENERALIZED_TCR_VIEW_ADDRESS environment variable'
  )
  process.exit(1)
}

if (!process.env.IPFS_GATEWAY) {
  console.error(
    'IPFS gateway URL not set. Please set the IPFS_GATEWAY environment variable'
  )
  process.exit(1)
}

if (!process.env.BLOCK_TIME_MILLISECONDS) {
  console.error(
    'Network block time not set. Please set the BLOCK_TIME_MILLISECONDS environment variable'
  )
  process.exit(1)
}

// UI
if (!process.env.GTCR_UI_URL) {
  console.error(
    'A link to the a UI is required. Please set the GTCR_UI_URL environment variable'
  )
  process.exit(1)
}
