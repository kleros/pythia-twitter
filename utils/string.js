const isVowel = c => ['a', 'e', 'i', 'o', 'u'].includes(c.toLowerCase())

module.exports = {
  articleFor: str => (str && isVowel(str[0]) ? 'an' : 'a')
}
