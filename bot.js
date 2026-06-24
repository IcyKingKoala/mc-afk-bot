const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const http = require('http')

const _host = process.env.MC_HOST
const _port = parseInt(process.env.MC_PORT || '25565', 10)
const _username = process.env.MC_USERNAME
const _password = process.env.MC_PASSWORD || null
const _httpport = parseInt(process.env.PORT || '3000', 10)

if (!_host || !_username) {
  console.log('Missing MC_HOST or MC_USERNAME in environment variables')
  process.exit(1)
}

const _keepaliveserver = http.createServer((req, res) => {
  res.writeHead(200)
  res.end('alive')
})
_keepaliveserver.listen(_httpport, () => {
  console.log(`Keep-alive HTTP server on port ${_httpport}`)
})

let _bot
let _antikicktimer
let _reconnecttimer
let _spawned = false

const _authphrases = [
  '/register', '/reg', 'please register', 'you need to register',
  'register to play', 'use /register', 'type /register'
]
const _loginphrases = [
  '/login', 'please login', 'you need to login',
  'use /login', 'type /login', 'log in to play', 'please log in'
]
const _captcharegex = /captcha[:\s]+([A-Za-z0-9]+)/i

function _humandelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function connect() {
  clearTimeout(_reconnecttimer)
  _spawned = false

  _bot = mineflayer.createBot({
    host: _host,
    port: _port,
    username: _username,
    auth: 'offline',
    version: '1.21.11',
    checkTimeoutInterval: 60000,
    defaultChatPatterns: true
  })

  _bot.loadPlugin(pathfinder)

  _bot.once('spawn', () => {
    _spawned = true
    console.log(`Spawned as ${_bot.username} on ${_host}:${_port}`)

    const _mcdata = require('minecraft-data')(_bot.version)
    const _movements = new Movements(_bot, _mcdata)
    _movements.allowSprinting = false
    _bot.pathfinder.setMovements(_movements)

    setTimeout(() => {
      if (_password) {
        _bot.chat(`/register ${_password} ${_password}`)
        setTimeout(() => _bot.chat(`/login ${_password}`), _humandelay(1500, 3000))
      }
      startAntiAfk()
    }, _humandelay(2000, 4000))
  })

  _bot.on('message', (_jsonmsg) => {
    const _msg = _jsonmsg.toString().toLowerCase()
    console.log(`[SERVER] ${_jsonmsg.toString()}`)

    const _captchamatch = _jsonmsg.toString().match(_captcharegex)
    if (_captchamatch) {
      setTimeout(() => _bot.chat(`/captcha ${_captchamatch[1]}`), _humandelay(800, 2000))
      return
    }

    if (_authphrases.some(p => _msg.includes(p))) {
      if (_password) {
        setTimeout(() => {
          _bot.chat(`/register ${_password} ${_password}`)
        }, _humandelay(1000, 2500))
      } else {
        console.log('Server wants /register but MC_PASSWORD is not set')
      }
      return
    }

    if (_loginphrases.some(p => _msg.includes(p))) {
      if (_password) {
        setTimeout(() => {
          _bot.chat(`/login ${_password}`)
        }, _humandelay(1000, 2500))
      } else {
        console.log('Server wants /login but MC_PASSWORD is not set')
      }
    }
  })

  _bot.on('kicked', (_reason) => {
    console.log('Kicked:', JSON.stringify(_reason))
    _spawned = false
  })

  _bot.on('error', (_err) => {
    console.log('Error:', _err.message)
    _spawned = false
  })

  _bot.on('end', () => {
    console.log('Disconnected. Reconnecting in 10s...')
    clearInterval(_antikicktimer)
    _spawned = false
    _reconnecttimer = setTimeout(connect, 10000)
  })
}

function startAntiAfk() {
  clearInterval(_antikicktimer)

  let _walkcycle = 0

  _antikicktimer = setInterval(() => {
    if (!_bot || !_bot.entity || !_spawned) return

    _walkcycle++

    if (_walkcycle % 3 === 0) {
      const _px = _bot.entity.position.x + (_humandelay(-3, 3))
      const _pz = _bot.entity.position.z + (_humandelay(-3, 3))
      const _goal = new goals.GoalXZ(_px, _pz)
      try {
        _bot.pathfinder.setGoal(_goal)
        setTimeout(() => _bot.pathfinder.setGoal(null), 4000)
      } catch (_e) {}
    } else {
      const _actions = ['jump', 'sneak', 'look']
      const _action = _actions[_walkcycle % _actions.length]

      if (_action === 'jump') {
        _bot.setControlState('jump', true)
        setTimeout(() => _bot.setControlState('jump', false), 300)
      } else if (_action === 'sneak') {
        _bot.setControlState('sneak', true)
        setTimeout(() => _bot.setControlState('sneak', false), 600)
      } else {
        _bot.look(
          _bot.entity.yaw + (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 0.4,
          true
        )
      }
    }
  }, _humandelay(25000, 45000))
}

connect()