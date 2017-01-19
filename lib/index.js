const client = require('./client')
const func = require('./func')

module.exports = (to_wrap, options) => {
  if (typeof to_wrap === 'function') {
    return func(to_wrap, options)
  }  

  return client(to_wrap, options)
}
