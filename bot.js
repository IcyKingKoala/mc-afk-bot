const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const http = require('http')

const _host = process.env.MC_HOST
const _port = parseInt(process.env.MC_PORT || '25565', 10)
const _username = process.env.MC_USERNAME
const _password = process.env.MC_PASSWORD || null
const _webpassword = process.env.WEB_PASSWORD || 'admin'
const _httpport = parseInt(process.env.PORT || '3000', 10)

if (!_host || !_username) {
  console.log('Missing MC_HOST or MC_USERNAME')
  process.exit(1)
}

let _bot
let _antikicktimer
let _reconnecttimer
let _spawned = false
let _registered = false
let _logs = []

function _log(msg) {
  const _line = `[${new Date().toLocaleTimeString()}] ${msg}`
  console.log(_line)
  _logs.push(_line)
  if (_logs.length > 100) _logs.shift()
}

function _humandelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const _html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MC Bot Console</title>
<style>
  body{background:#1a1a1a;color:#eee;font-family:monospace;margin:0;padding:16px}
  h2{color:#5af;margin:0 0 12px}
  #login{max-width:320px;margin:80px auto;background:#222;padding:24px;border-radius:8px}
  #login input{width:100%;padding:8px;margin:8px 0;background:#333;border:1px solid #444;color:#eee;border-radius:4px;box-sizing:border-box}
  #console{max-width:700px;margin:0 auto}
  #logs{background:#111;border:1px solid #333;border-radius:6px;padding:12px;height:340px;overflow-y:auto;margin-bottom:12px;font-size:13px;white-space:pre-wrap;word-break:break-all}
  .row{display:flex;gap:8px}
  #cmd{flex:1;padding:10px;background:#222;border:1px solid #444;color:#eee;border-radius:4px;font-family:monospace;font-size:14px}
  button{padding:10px 18px;background:#5af;border:none;border-radius:4px;color:#000;font-weight:bold;cursor:pointer}
  button:hover{background:#7cf}
  #status{margin-bottom:10px;font-size:13px}
  .on{color:#4f4}.off{color:#f44}
</style>
</head>
<body>
<div id="login">
  <h2>MC Bot Console</h2>
  <input id="pw" type="password" placeholder="Web password" />
  <button onclick="doLogin()">Login</button>
</div>
<div id="console" style="display:none">
  <h2>MC Bot Console</h2>
  <div id="status"></div>
  <div id="logs"></div>
  <div class="row">
    <input id="cmd" placeholder="Type a command or chat message..." onkeydown="if(event.key==='Enter')send()" />
    <button onclick="send()">Send</button>
  </div>
</div>
<script>
  let _token = ''
  function doLogin() {
    _token = document.getElementById('pw').value
    fetch('/status', {headers:{'x-token':_token}}).then(r => {
      if (r.ok) { document.getElementById('login').style.display='none'; document.getElementById('console').style.display='block'; poll() }
      else alert('Wrong password')
    })
  }
  function send() {
    const _inp = document.getElementById('cmd')
    const _val = _inp.value.trim()
    if (!_val) return
    fetch('/cmd', {method:'POST', headers:{'Content-Type':'application/json','x-token':_token}, body:JSON.stringify({cmd:_val})})
    _inp.value = ''
  }
  function poll() {
    fetch('/logs', {headers:{'x-token':_token}}).then(r=>r.json()).then(d => {
      document.getElementById('logs').textContent = d.logs.join('\\n')
      document.getElementById('logs').scrollTop = 999999
      document.getElementById('status').innerHTML = d.spawned
        ? '<span class="on">● Connected</span>'
        : '<span class="off">● Disconnected / Reconnecting...</span>'
    })
    setTimeout(poll, 2000)
  }
</script>
</body>
</html>`

const _webserver = http.createServer((req, res) => {
  const _token = req.headers['x-token']
  const _auth = _token === _webpassword

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, {'Content-Type': 'text/html'})
    res.end(_html)
    return
  }

  if (!_auth) {
    res.writeHead(401)
    res.end('Unauthorized')
    return
  }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200)
    res.end('ok')
    return
  }

  if (req.method === 'GET' && req.url === '/logs') {
    res.writeHead(200, {'Content-Type': 'application/json'})
    res.end(JSON.stringify({logs: _logs, spawned: _spawned}))
    return
  }

  if (req.method === 'POST' && req.url === '/cmd') {
    let _body = ''
    req.on('data', c => _body += c)
    req.on('end', () => {
      try {
        const _data = JSON.parse(_body)
        if (_bot && _spawned && _data.cmd) {
          _bot.chat(_data.cmd)
          _log(`[YOU] ${_data.cmd}`)
        } else {
          _log('Cannot send: bot not connected yet')
        }
      } catch {}
      res.writeHead(200)
      res.end('ok')
    })
    return
  }

  res.writeHead(200)
  res.end('alive')
})

_webserver.listen(_httpport, () => {
  _log(`Web console running on port ${_httpport}`)
})

function connect() {
  clearTimeout(_reconnecttimer)
  _spawned = false

  _bot = mineflayer.createBot({
    host: _host,
    port: _port,
    username: _username,
    auth: 'offline',
    version: '1.21.11',
    checkTimeoutInterval: 60000
  })

  _bot.loadPlugin(pathfinder)

  _bot.once('spawn', () => {
    _spawned = true
    _log(`Connected as ${_bot.username} on ${_host}:${_port}`)

    const _mcdata = require('minecraft-data')(_bot.version)
    const _movements = new Movements(_bot, _mcdata)
    _movements.allowSprinting = false
    _bot.pathfinder.setMovements(_movements)

    if (_password) {
      if (!_registered) {
        setTimeout(() => {
          _bot.chat(`/register ${_password} ${_password}`)
          _log(`Sent /register`)
          _registered = true
        }, _humandelay(2000, 4000))
      } else {
        setTimeout(() => {
          _bot.chat(`/login ${_password}`)
          _log(`Sent /login`)
        }, _humandelay(2000, 4000))
      }
    }

    setTimeout(startAntiAfk, 5000)
  })

  _bot.on('message', (_jsonmsg) => {
    const _msg = _jsonmsg.toString()
    const _lower = _msg.toLowerCase()
    _log(`[CHAT] ${_msg}`)

    const _captchamatch = _msg.match(/captcha[:\s]+([A-Za-z0-9]+)/i)
    if (_captchamatch) {
      setTimeout(() => {
        _bot.chat(`/captcha ${_captchamatch[1]}`)
        _log(`Sent /captcha ${_captchamatch[1]}`)
      }, _humandelay(800, 2000))
      return
    }

    if (_password && (_lower.includes('register') || _lower.includes('/register'))) {
      if (!_registered) {
        setTimeout(() => {
          _bot.chat(`/register ${_password} ${_password}`)
          _log('Sent /register (triggered by chat)')
          _registered = true
        }, _humandelay(1000, 2500))
      }
    }

    if (_password && (_lower.includes('login') || _lower.includes('/login'))) {
      if (_registered) {
        setTimeout(() => {
          _bot.chat(`/login ${_password}`)
          _log('Sent /login (triggered by chat)')
        }, _humandelay(1000, 2500))
      }
    }
  })

  _bot.on('kicked', (_reason) => {
    _spawned = false
    _log(`Kicked: ${JSON.stringify(_reason)}`)
  })

  _bot.on('error', (_err) => {
    _spawned = false
    _log(`Error: ${_err.message}`)
  })

  _bot.on('end', () => {
    _spawned = false
    clearInterval(_antikicktimer)
    _log('Disconnected. Reconnecting in 10s...')
    _reconnecttimer = setTimeout(connect, 10000)
  })
}

function startAntiAfk() {
  clearInterval(_antikicktimer)
  let _cycle = 0

  _antikicktimer = setInterval(() => {
    if (!_bot || !_bot.entity || !_spawned) return
    _cycle++

    if (_cycle % 3 === 0) {
      const _px = _bot.entity.position.x + _humandelay(-3, 3)
      const _pz = _bot.entity.position.z + _humandelay(-3, 3)
      try {
        _bot.pathfinder.setGoal(new goals.GoalXZ(_px, _pz))
        setTimeout(() => _bot.pathfinder.setGoal(null), 4000)
      } catch {}
    } else if (_cycle % 3 === 1) {
      _bot.setControlState('jump', true)
      setTimeout(() => _bot.setControlState('jump', false), 300)
    } else {
      _bot.look(
        _bot.entity.yaw + (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 0.4,
        true
      )
    }
  }, _humandelay(25000, 45000))
}

connect()
