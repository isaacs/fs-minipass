'use strict'

const t = require('tap')
const fsm = require('../')
const fs = require('fs')
const { resolve } = require('path')
const mutateFS = require('mutate-fs')

t.test('read the readme', t => {
  const p = resolve(__dirname, '..', 'README.md')
  const rm = fs.readFileSync(p, 'utf8')
  const check = (t, res) => {
    t.equal(rm, res)
    t.end()
  }

  t.test('sync', t => {
    const str = new fsm.ReadStreamSync(p, { encoding: 'utf8' })
    t.type(str.fd, 'number')
    const out = []
    str.on('data', chunk => out.push(chunk))
    check(t, out.join(''))
  })

  t.test('sync using read()', t => {
    const str = new fsm.ReadStreamSync(p, { encoding: 'utf8' })
    t.type(str.fd, 'number')
    const out = []
    let chunk
    while (chunk = str.read()) {
      out.push(chunk)
    }
    check(t, out.join(''))
  })

  return t.test('async', t => {
    const str = new fsm.ReadStream(p, { encoding: 'utf8' })
    t.equal(str.fd, null)
    let sawFD
    str.on('open', fd => sawFD = fd)
    const out = []
    t.equal(str.read(), null)
    str.on('data', chunk => out.push(chunk))
    str.on('close', _ => {
      t.type(sawFD, 'number')
      check(t, out.join(''))
    })
  })
})

t.test('read the readme sized', t => {
  const p = resolve(__dirname, '..', 'README.md')
  const size = fs.statSync(p).size
  const rm = fs.readFileSync(p, 'utf8')
  const check = (t, res) => {
    t.equal(rm, res)
    t.end()
  }

  t.test('sync', t => {
    const str = new fsm.ReadStreamSync(p, { encoding: 'utf8', size: size })
    t.equal(str.fd, null)
    const out = []
    str.on('data', chunk => out.push(chunk))
    check(t, out.join(''))
  })

  t.test('sync using read()', t => {
    const str = new fsm.ReadStreamSync(p, { encoding: 'utf8', size: size })
    t.equal(str.fd, null)
    const out = []
    let chunk
    while (chunk = str.read()) {
      out.push(chunk)
    }
    check(t, out.join(''))
  })

  return t.test('async', t => {
    const str = new fsm.ReadStream(p, { encoding: 'utf8', size: size })
    t.equal(str.fd, null)
    let sawFD
    str.on('open', fd => sawFD = fd)
    const out = []
    t.equal(str.read(), null)
    str.on('data', chunk => out.push(chunk))
    str.on('end', _ => {
      t.type(sawFD, 'number')
      check(t, out.join(''))
    })
  })
})

t.test('slow sink', t => {
  const chunks = []
  const EE = require('events').EventEmitter
  class SlowStream extends EE {
    write (chunk) {
      chunks.push(chunk)
      setTimeout(_ => this.emit('drain'))
      return false
    }

    end () {
      return this.write()
    }
  }

  const p = resolve(__dirname, '..', 'README.md')
  const rm = fs.readFileSync(p, 'utf8')
  const check = t => {
    t.equal(chunks.join(''), rm)
    chunks.length = 0
    t.end()
  }

  t.test('sync', t => {
    const ss = new SlowStream()
    const str = new fsm.ReadStreamSync(p, { encoding: 'utf8', readSize: 5 })
    str.pipe(ss)
    // trigger a read-while-reading
    str.on('readable', _ => str.emit('drain'))
    str.on('end', _ => check(t))
  })

  return t.test('async', t => {
    const ss = new SlowStream()
    const str = new fsm.ReadStream(p, { encoding: 'utf8', readSize: 256 })
    str.pipe(ss)
    str.on('end', _ => check(t))
  })
})

t.test('zeno reading style', t => {
  t.teardown(mutateFS.zenoRead())
  const chunks = []
  const EE = require('events').EventEmitter
  class Collector extends EE {
    write (chunk) {
      chunks.push(chunk)
      return true
    }

    end () {}
  }

  const p = resolve(__dirname, '..', 'README.md')
  const rm = fs.readFileSync(p, 'utf8')
  const check = t => {
    t.equal(chunks.join(''), rm)
    chunks.length = 0
    t.end()
  }

  t.test('sync', t => {
    const ss = new Collector()
    const str = new fsm.ReadStreamSync(p, { encoding: 'utf8', readSize: 256 })
    str.pipe(ss)
    check(t)
  })

  return t.test('async', t => {
    const ss = new Collector()
    const str = new fsm.ReadStream(p, { encoding: 'utf8', readSize: 256 })
    str.pipe(ss)
    str.on('end', _ => check(t))
  })
})

t.test('fail open', t => {
  const poop = new Error('poop')
  t.teardown(mutateFS.fail('open', poop))
  t.throws(_ => new fsm.ReadStreamSync(__filename), poop)
  const str = new fsm.ReadStream(__filename)
  str.on('error', er => {
    t.equal(er, poop)
    t.end()
  })
})

t.test('fail close', t => {
  const poop = new Error('poop')
  t.teardown(mutateFS.fail('close', poop))
  t.throws(_ => new fsm.ReadStreamSync(__filename).resume(), poop)
  const str = new fsm.ReadStream(__filename)
  str.resume()
  str.on('error', er => {
    t.equal(er, poop)
    t.end()
  })
})

t.test('type errors', t => {
  const er = new TypeError('this is a readable stream')
  t.throws(_ => new fsm.ReadStream(__filename).write('hello'), er)
  t.throws(_ => new fsm.ReadStream(__filename).end(), er)
  const pathstr = new TypeError('path must be a string')
  t.throws(_ => new fsm.ReadStream(1234), pathstr)
  t.end()
})

t.test('fail read', t => {
  // also fail close, just to exercise the double-error logic
  const closeError = new Error('close error')
  t.teardown(mutateFS.fail('close', closeError))

  const poop = new Error('poop')
  const badFDs = new Set()
  const read = fs.read
  const readSync = fs.readSync
  const open = fs.open
  const openSync = fs.openSync

  t.teardown(_ => {
    fs.open = open
    fs.openSync = openSync
    fs.read = read
    fs.readSync = readSync
  })

  fs.open = (path, flags, cb) => {
    if (path === __filename) {
      open(path, flags, (er, fd) => {
        if (!er) {
          badFDs.add(fd)
        }
        return cb(er, fd)
      })
    } else {
      open(path, flags, cb)
    }
  }

  fs.openSync = (path, flags) => {
    const fd = openSync(path, flags)
    if (path === __filename) {
      badFDs.add(fd)
    }
    return fd
  }

  fs.read = function (fd, buf, offset, length, pos, cb) {
    if (badFDs.has(fd)) {
      process.nextTick(_ => cb(new Error('poop')))
    } else {
      read(fd, buf, offset, length, pos, cb)
    }
  }

  fs.readSync = function (fd, buf, offset, length, pos) {
    if (badFDs.has(fd)) {
      throw new Error('poop sync')
    }
  }

  t.throws(_ => new fsm.ReadStreamSync(__filename))

  t.test('async', t => {
    const str = new fsm.ReadStream(__filename)
    str.once('error', er => {
      t.match(er, poop)
      t.end()
    })
  })

  t.end()
})

t.test('fd test', t => {
  const p = resolve(__dirname, '..', 'README.md')
  const rm = fs.readFileSync(p, 'utf8')
  const check = (t, res) => {
    t.equal(rm, res)
    t.end()
  }

  t.test('sync', t => {
    const fd = fs.openSync(p, 'r')
    const str = new fsm.ReadStreamSync(p, { encoding: 'utf8', fd: fd })
    t.type(str.fd, 'number')
    t.equal(str.path, p)
    const out = []
    str.on('data', chunk => out.push(chunk))
    check(t, out.join(''))
  })

  t.test('sync using read()', t => {
    const fd = fs.openSync(p, 'r')
    const str = new fsm.ReadStreamSync(p, { encoding: 'utf8', fd: fd })
    t.type(str.fd, 'number')
    t.equal(str.path, p)
    const out = []
    let chunk
    while (chunk = str.read()) {
      out.push(chunk)
    }
    check(t, out.join(''))
  })

  t.test('async', t => {
    const fd = fs.openSync(p, 'r')
    const str = new fsm.ReadStream(p, { encoding: 'utf8', fd: fd })
    t.type(str.fd, 'number')
    t.equal(str.path, p)
    const out = []
    t.equal(str.read(), null)
    str.on('data', chunk => out.push(chunk))
    str.on('end', _ => check(t, out.join('')))
  })

  t.end()
})

t.test('fd test, no autoClose', t => {
  const p = resolve(__dirname, '..', 'README.md')
  const rm = fs.readFileSync(p, 'utf8')
  const check = (t, res, fd) => {
    // will throw EBADF if already closed
    fs.closeSync(fd)
    t.equal(rm, res)
    t.end()
  }

  t.test('sync', t => {
    const fd = fs.openSync(p, 'r')
    const str = new fsm.ReadStreamSync(p, {
      encoding: 'utf8',
      fd: fd,
      autoClose: false,
    })
    t.type(str.fd, 'number')
    t.equal(str.path, p)
    const out = []
    str.on('data', chunk => out.push(chunk))
    check(t, out.join(''), fd)
  })

  t.test('sync using read()', t => {
    const fd = fs.openSync(p, 'r')
    const str = new fsm.ReadStreamSync(p, {
      encoding: 'utf8',
      fd: fd,
      autoClose: false,
    })
    t.type(str.fd, 'number')
    t.equal(str.path, p)
    const out = []
    let chunk
    while (chunk = str.read()) {
      out.push(chunk)
    }
    check(t, out.join(''), fd)
  })

  t.test('async', t => {
    const fd = fs.openSync(p, 'r')
    const str = new fsm.ReadStream(p, {
      encoding: 'utf8',
      fd: fd,
      autoClose: false,
    })
    t.type(str.fd, 'number')
    t.equal(str.path, p)
    const out = []
    t.equal(str.read(), null)
    str.on('data', chunk => out.push(chunk))
    str.on('end', _ => check(t, out.join(''), fd))
  })

  t.end()
})
