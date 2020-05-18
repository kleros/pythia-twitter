const isVowel = c => ['a', 'e', 'i', 'o', 'u'].includes(c.toLowerCase())
const truncateETHValue = (n, decimals = 2) =>
  String(n).slice(0, String(n).indexOf('.') + 1 + decimals)

const truncateETHAddress = ethAddr =>
  `${ethAddr.slice(0, 5)}...${ethAddr.slice(40)}`

const capitalizeFirstLetter = input =>
  input.charAt(0).toUpperCase() + input.slice(1)

module.exports = {
  articleFor: str => (str && isVowel(str[0]) ? 'an' : 'a'),
  truncateETHValue,
  truncateETHAddress,
  capitalizeFirstLetter
}
