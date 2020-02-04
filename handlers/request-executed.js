// eslint-disable-next-line unicorn/consistent-function-scoping
module.exports = () => async (
  _itemID,
  _requestIndex,
  _roundIndex,
  _disputed,
  _resolved
) => {
  // eslint-disable-next-line no-useless-return
  if (_disputed || !_resolved) return // Only handle request executed.

  // TODO: Fetch reference to tweet in db add reply.
  // TODO: Tweet about request executed without challenges.
}
