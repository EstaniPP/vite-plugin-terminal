import { lightGray, lightGreen, lightMagenta, lightRed, lightYellow } from 'kolorist'
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import { parseURL } from 'ufo'
import rollupPluginStrip from '@rollup/plugin-strip'
import table from './table'
import { dispatchLog } from './logQueue'

const virtualId = 'virtual:terminal'
const virtualResolvedId = `\0${virtualId}`
let groupLevel = 0

export type FilterPattern = ReadonlyArray<string | RegExp> | string | RegExp | null

export interface Options {
  /**
   * Remove logs in production
   *
   * @default true
   */
  strip?: boolean

  /**
   * Filter for modules to be processed to remove logs
   */
  include?: FilterPattern
  /**
   * Filter for modules to not be processed to remove logs
   */
  exclude?: FilterPattern
}

const methods = ['assert', 'error', 'info', 'log', 'table', 'warn', 'group', 'groupEnd'] as const
type Method = typeof methods[number]

const colors = {
  assert: lightGreen,
  error: lightRed,
  info: lightGray,
  log: lightMagenta,
  warn: lightYellow,
}

const groupText = (text: string) => {
  if (groupLevel !== 0)
    return `${'  '.repeat(groupLevel)}${text.split('\n').join(`\n${'  '.repeat(groupLevel)}`)}`
  else
    return text
}

function pluginTerminal(options: Options = {}) {
  const {
    include = /.+\.(js|ts|mjs|cjs|mts|cts)/,
    exclude,
  } = options
  let config: ResolvedConfig
  let virtualModuleCode: string

  const terminal = <Plugin>{
    name: 'virtual:terminal',
    configResolved(_config: ResolvedConfig) {
      config = _config
    },
    resolveId(id = ''): string | undefined {
      if (id === virtualId)
        return virtualResolvedId
    },
    load(id: string) {
      if (id === virtualResolvedId) {
        virtualModuleCode ||= generateVirtualModuleCode()
        return virtualModuleCode
      }
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__terminal', (req, res) => {
        const { pathname, search } = parseURL(req.url)
        const [messageURL, queueOrder, extraProps] = search.slice(1).split('&')
        const message = decodeURI(messageURL).split('\n').join('\n  ')
        if (pathname[0] === '/') {
          const method = pathname.slice(1) as Method
          if (methods.includes(method)) {
            switch (method) {
              case 'table': {
                const obj = JSON.parse(message)
                const indent = 2 * (groupLevel + 1)
                dispatchLog({ priority: parseInt(queueOrder), dispatchFunction: () => config.logger.info(`» ${table(obj, indent)}`) })
                break
              }
              case 'log': {
                let obj = JSON.parse(message)
                if (Array.isArray(obj))
                  obj = obj.length === 1 ? JSON.stringify(obj[0], null, 2) : obj.toString()
                dispatchLog({ priority: parseInt(queueOrder), dispatchFunction: () => config.logger.info(colors.log(`» ${groupText(obj)}`)) })
                break
              }
              case 'group': {
                dispatchLog({ priority: parseInt(queueOrder), dispatchFunction: () => groupLevel++ })
                break
              }
              case 'groupEnd': {
                dispatchLog({ priority: parseInt(queueOrder), dispatchFunction: () => groupLevel = groupLevel === 0 ? groupLevel : --groupLevel })
                break
              }
              default: {
                const color = colors[method]
                dispatchLog({ priority: parseInt(queueOrder), dispatchFunction: () => config.logger.info(color(`» ${groupText(message)}`)) })
                break
              }
            }
          }
        }
        res.end()
      })
    },
  }
  const strip = <Plugin>{
    ...rollupPluginStrip({
      include,
      exclude,
      functions: methods.map(name => `terminal.${name}`),
    }),
    apply: 'build',
  }
  return [terminal, options.strip !== false && strip]
}

function generateVirtualModuleCode() {
  return `export const terminal = ${createTerminal.toString()}()
export default terminal
`
}
function createTerminal() {
  let queueOrder = 0
  function send(type: string, obj?: any) {
    console.log(obj)
    if (obj) {
      const message = typeof obj === 'object' ? `${JSON.stringify(obj, null, 2)}` : obj.toString()
      fetch(`/__terminal/${type}?${encodeURI(`${message}&${queueOrder++}`)}`)
    }
    else {
      fetch(`/__terminal/${type}?${encodeURI(`&${queueOrder++}`)}`)
    }
  }
  return {
    assert: (assertion: boolean, obj: any) => assertion && send('assert', obj),
    error: (obj: any) => send('error', obj),
    info: (obj: any) => send('info', obj),
    log: (...obj: any[]) => send('log', obj),
    table: (obj: any) => send('table', obj),
    warn: (obj: any) => send('warn', obj),
    group: () => send('group'),
    groupEnd: () => send('groupEnd'),
  }
}

export default pluginTerminal
