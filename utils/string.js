const isVowel = c => ['a', 'e', 'i', 'o', 'u'].includes(c.toLowerCase())
const truncateETH = (n, decimals = 2) =>
  String(n).slice(0, String(n).indexOf('.') + 1 + decimals)

module.exports = {
  articleFor: str => (str && isVowel(str[0]) ? 'an' : 'a'),
  truncateETH
}
