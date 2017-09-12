'use strict'

const t = require('tap')
const fsm = require('../')
const fs = require('fs')
const EE = require('events').EventEmitter
const mutateFS = require('mutate-fs')

t.test('basic write', t => {
  const p = __dirname + '/basic-write'

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'ok')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    new fsm.WriteStreamSync(p).end('ok')
    check(t)
  })

  t.test('async', t => {
    const s = new fsm.WriteStream(p)
    s.end('ok')
    s.on('close', _ => check(t))
  })

  t.end()
})

t.test('write then end', t => {
  const p = __dirname + '/write-then-end'

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'okend')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    const s = new fsm.WriteStreamSync(p)
    s.write('ok')
    s.end('end')
    check(t)
  })

  t.test('async', t => {
    const s = new fsm.WriteStream(p)
    s.write('ok')
    s.end('end')
    s.on('finish', _ => check(t))
  })

  t.end()
})

t.test('multiple writes', t => {
  const p = __dirname + '/multiple-writes'

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'abcdefghijklmnop')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    const s = new fsm.WriteStreamSync(p)
    s.write('a')
    s.write('b')
    s.write('c')
    s.write('d')
    s.write('e')
    s.write('f')
    s.write(new Buffer('676869', 'hex'))
    s.write('jklm')
    s.write(new Buffer('nop'))
    s.end()
    check(t)
  })

  t.test('async', t => {
    const s = new fsm.WriteStream(p)
    s.write('a')
    s.write('b')
    s.write('c')
    s.write('d')
    s.write('e')
    s.write('f')
    s.write(new Buffer('676869', 'hex'))
    s.write('jklm')
    s.write(new Buffer('nop'))
    s.end()
    s.on('finish', _ => check(t))
  })

  t.test('async after open', t => {
    const s = new fsm.WriteStream(p)
    s.on('open', fd => {
      t.isa(fd, 'number')
      t.ok(s.write('a'))
      t.notOk(s.write('b'))
      t.notOk(s.write('c'))
      t.notOk(s.write('d'))
      t.notOk(s.write('e'))
      t.notOk(s.write('f'))
      t.notOk(s.write(new Buffer('676869', 'hex')))
      t.notOk(s.write('jklm'))
      t.notOk(s.write(new Buffer('nop')))
      s.end()
      s.on('finish', _ => check(t))
    })
  })

  t.test('async after open, drains', t => {
    const s = new fsm.WriteStream(p)
    s.on('open', fd => {
      t.isa(fd, 'number')
      t.ok(s.write('a'))
      t.notOk(s.write('b'))
      s.once('drain', _ => {
        t.ok(s.write('c'))
        t.notOk(s.write('d'))
        t.notOk(s.write('e'))
        s.once('drain', _ => {
          t.ok(s.write('f'))
          t.notOk(s.write(new Buffer('676869', 'hex')))
          t.notOk(s.write('jklm'))
          t.notOk(s.write(new Buffer('nop')))
          s.once('drain', _ => s.end())
        })
      })
      s.on('finish', _ => check(t))
    })
  })
  t.end()
})

t.test('flags', t => {
  const p = __dirname + '/flags'

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'ok')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    new fsm.WriteStreamSync(p, { flags: 'w+' }).end('ok')
    check(t)
  })

  t.test('async', t => {
    const s = new fsm.WriteStream(p, { flags: 'w+' })
    s.end('ok')
    s.on('finish', _ => check(t))
  })

  t.end()
})

t.test('mode', t => {
  const p = __dirname + '/mode'

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'ok')
    t.equal(fs.statSync(p).mode & 0o777, 0o700)
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    new fsm.WriteStreamSync(p, { mode: 0o700 }).end('ok')
    check(t)
  })

  t.test('async', t => {
    const s = new fsm.WriteStream(p, { mode: 0o700 })
    s.end('ok')
    s.on('finish', _ => check(t))
  })

  t.end()
})

t.test('write after end', t => {
  const p = __dirname + '/write-after-end'

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'ok')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    const s = new fsm.WriteStreamSync(p, { mode: 0o700 })
    s.end('ok')
    t.throws(_ => s.write('626164', 'hex'),
      new Error('write() after end()'))
    check(t)
  })

  t.test('async', t => {
    const s = new fsm.WriteStream(p, { mode: 0o700 })
    s.end('ok')
    s.on('error', e => {
      t.match(e, new Error('write() after end()'))
      s.on('finish', _ => check(t))
    })
    s.write('626164', 'hex')
  })

  t.end()
})

t.test('fd', t => {
  const p = __dirname + '/fd'

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'ok')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    const fd = fs.openSync(p, 'w')
    new fsm.WriteStreamSync(p, { fd: fd }).end('ok')
    check(t)
  })

  t.test('async', t => {
    const fd = fs.openSync(p, 'w')
    const s = new fsm.WriteStream(p, { fd: fd })
    s.end('ok')
    s.on('finish', _ => check(t))
  })

  t.end()
})

t.test('empty write', t => {
  const p = __dirname + '/empty-write'

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), '')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    t.test('empty string', t => {
      new fsm.WriteStreamSync(p).end('')
      check(t)
    })
    t.test('no chunk to end', t => {
      new fsm.WriteStreamSync(p).end('')
      check(t)
    })
    t.end()
  })

  return t.test('async', t => {
    t.test('immediate', t => {
      t.test('no chunk to end', t => {
        const s = new fsm.WriteStream(p)
        s.end()
        s.on('finish', _ => check(t))
      })

      return t.test('empty string', t => {
        const s = new fsm.WriteStream(p)
        s.end('')
        s.on('finish', _ => check(t))
      })
    })

    return t.test('end on open', t => {
      t.test('no chunk to end', t => {
        const s = new fsm.WriteStream(p)
        s.on('open', _ => s.end())
        s.on('finish', _ => check(t))
      })

      return t.test('empty string', t => {
        const s = new fsm.WriteStream(p)
        s.on('open', _ => s.end(''))
        s.on('finish', _ => check(t))
      })
    })
  })
})

t.test('fail open', t => {
  const p = __dirname + '/fail-open'
  const poop = new Error('poop')
  t.teardown(mutateFS.fail('open', poop))
  t.throws(_ => new fsm.WriteStreamSync(p), poop)
  const str = new fsm.WriteStream(p)
  str.on('error', er => {
    t.equal(er, poop)
    t.end()
  })
})

t.test('fail write', t => {
  const p = __dirname + '/fail-write'
  const poop = new Error('poop')
  t.teardown(mutateFS.fail('write', poop))

  t.throws(_ => new fsm.WriteStreamSync(p).write('foo'), poop)
  const str = new fsm.WriteStream(p)
  str.write('foo')
  str.on('error', er => {
    t.equal(er, poop)
    fs.unlinkSync(p)
    t.end()
  })
})

t.test('positioned write', t => {
  const p = __dirname + '/positioned-write'
  const write = new Buffer('this is the data that is written')

  const data = Buffer.allocUnsafe(256)
  for (let i = 0; i < 256; i++) {
    data[i] = i
  }

  const expect = new Buffer(data.toString('hex'), 'hex')
  for (let i = 0; i < write.length; i++) {
    expect[i + 100] = write[i]
  }

  const check = t => {
    t.same(fs.readFileSync(p), expect)
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    fs.writeFileSync(p, data)
    new fsm.WriteStreamSync(p, { start: 100 }).end(write)
    check(t)
  })

  t.test('async', t => {
    fs.writeFileSync(p, data)
    const s = new fsm.WriteStream(p, { start: 100 })
    s.end(write)
    s.on('finish', _ => check(t))
  })

  t.end()
})

t.test('positioned then unpositioned', t => {
  const p = __dirname + '/positioned-then-unpositioned'
  const write = new Buffer('this is the data that is written')

  const data = Buffer.allocUnsafe(256)
  for (let i = 0; i < 256; i++) {
    data[i] = i
  }

  const expect = new Buffer(data.toString('hex'), 'hex')
  for (let i = 0; i < write.length; i++) {
    expect[i + 100] = write[i]
  }

  const check = t => {
    t.same(fs.readFileSync(p), expect)
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    fs.writeFileSync(p, data)
    const s = new fsm.WriteStreamSync(p, { start: 100 })
    s.write(write.slice(0, 20))
    s.end(write.slice(20))
    check(t)
  })

  t.test('async', t => {
    fs.writeFileSync(p, data)
    const s = new fsm.WriteStream(p, { start: 100 })
    s.write(write.slice(0, 20))
    s.end(write.slice(20))
    s.on('close', _ => check(t))
  })

  t.end()
})

t.test('positioned then unpositioned at zero', t => {
  const p = __dirname + '/positioned-then-unpositioned'
  const write = new Buffer('this is the data that is written')

  const data = Buffer.allocUnsafe(256)
  for (let i = 0; i < 256; i++) {
    data[i] = i
  }

  const expect = new Buffer(data.toString('hex'), 'hex')
  for (let i = 0; i < write.length; i++) {
    expect[i] = write[i]
  }

  const check = t => {
    t.same(fs.readFileSync(p), expect)
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    fs.writeFileSync(p, data)
    const s = new fsm.WriteStreamSync(p, { start: 0 })
    s.write(write.slice(0, 20))
    s.end(write.slice(20))
    check(t)
  })

  t.test('async', t => {
    fs.writeFileSync(p, data)
    const s = new fsm.WriteStream(p, { start: 0 })
    s.write(write.slice(0, 20))
    s.end(write.slice(20))
    s.on('close', _ => check(t))
  })

  t.end()
})
