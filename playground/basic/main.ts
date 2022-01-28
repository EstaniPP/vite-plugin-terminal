import terminal from 'virtual:terminal'
import './module.js'

terminal.log('Hey terminal! A message from the browser')

const json = { foo: 'bar' }

terminal.group()
terminal.group()
terminal.group()

terminal.log({ json })
terminal.log('Firast arg', 'Second arg')

terminal.assert(true, 'Assertion pass')
terminal.assert(false, 'Assertion fails')

terminal.info('Some info from the app')

terminal.table(['vite', 'plugin', 'terminal'])

terminal.groupEnd()
terminal.groupEnd()
terminal.groupEnd()
terminal.log('Hey final terminal! A message from the browser')
