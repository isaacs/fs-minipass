import fs from 'fs'
import mutateFS from 'mutate-fs'
import { dirname, join } from 'path'
import t from 'tap'
import { fileURLToPath } from 'url'
import { WriteStream, WriteStreamSync } from '../dist/esm/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

t.test('basic write', t => {
  const p = join(__dirname, 'basic-write')

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'ok')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    const s = new WriteStreamSync(p)
    s.end('ok')
    check(t)
  })

  t.test('async', t => {
    const s = new WriteStream(p)
    s.end('ok')
    s.on('close', _ => check(t))
  })

  t.end()
})

t.test('write then end', t => {
  const p = join(__dirname, '/write-then-end')

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'okend')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    const s = new WriteStreamSync(p)
    s.write('ok')
    s.end('end')
    check(t)
  })

  t.test('async', t => {
    const s = new WriteStream(p)
    s.write('ok')
    s.end('end')
    t.equal(s.fd, undefined)
    t.equal(s.path, p)
    s.on('open', fd => {
      t.equal(fd, s.fd)
      t.type(fd, 'number')
    })
    s.on('finish', _ => check(t))
  })

  t.end()
})

t.test('multiple writes', t => {
  const p = join(__dirname, '/multiple-writes')

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'abcdefghijklmnop')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    const s = new WriteStreamSync(p)
    s.write('a')
    s.write('b')
    s.write('c')
    s.write('d')
    s.write('e')
    s.write('f')
    s.write(Buffer.from('676869', 'hex'))
    s.write('jklm')
    s.write(Buffer.from('nop'))
    s.end()
    check(t)
  })

  t.test('async', t => {
    const s = new WriteStream(p)
    s.write('a')
    s.write('b')
    s.write('c')
    s.write('d')
    s.write('e')
    s.write('f')
    s.write(Buffer.from('676869', 'hex'))
    s.write('jklm')
    s.write(Buffer.from('nop'))
    s.end()
    s.on('finish', _ => check(t))
  })

  t.test('async after open', t => {
    const s = new WriteStream(p)
    s.on('open', fd => {
      t.type(fd, 'number')
      t.ok(s.write('a'))
      t.notOk(s.write('b'))
      t.notOk(s.write('c'))
      t.notOk(s.write('d'))
      t.notOk(s.write('e'))
      t.notOk(s.write('f'))
      t.notOk(s.write(Buffer.from('676869', 'hex')))
      t.notOk(s.write('jklm'))
      t.notOk(s.write(Buffer.from('nop')))
      s.end()
      s.on('finish', _ => check(t))
    })
  })

  t.test('async after open, drains', t => {
    const s = new WriteStream(p)
    s.on('open', fd => {
      t.type(fd, 'number')
      t.ok(s.write('a'))
      t.notOk(s.write('b'))
      s.once('drain', _ => {
        t.ok(s.write('c'))
        t.notOk(s.write('d'))
        t.notOk(s.write('e'))
        s.once('drain', () => {
          t.ok(s.write('f'))
          t.notOk(s.write(Buffer.from('676869', 'hex')))
          t.notOk(s.write('jklm'))
          t.notOk(s.write(Buffer.from('nop')))
          s.once('drain', () => s.end())
        })
      })
      s.on('finish', () => check(t))
    })
  })

  t.test('async after open, writev delayed', t => {
    ;(async () => {
      const _fsm = await t.mockImport('../dist/esm/index.js', {
        fs: {
          ...fs,
          writev: (...args) => {
            setTimeout(fs.writev, 1000, ...args) // make writev very slow
          },
        },
      })

      const s = new _fsm.WriteStream(p)
      s.on('open', fd => {
        t.type(fd, 'number')
        t.ok(s.write('a'))
        t.notOk(s.write('b'))
        t.notOk(s.write('c'))
        t.notOk(s.write('d'))
        t.notOk(s.write('e'))
        t.notOk(s.write('f'))
        t.notOk(s.write(Buffer.from('676869', 'hex')))
        t.notOk(s.write('jklm'))
        t.notOk(s.write(Buffer.from('nop')))
        s.end()
        s.on('finish', _ => check(t))
      })
    })()
  })
  t.end()
})

t.test('flags', t => {
  const p = join(__dirname, '/flags')

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'ok')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    new WriteStreamSync(p, { flags: 'w+' }).end('ok')
    check(t)
  })

  t.test('async', t => {
    const s = new WriteStream(p, { flags: 'w+' })
    s.end('ok')
    s.on('finish', _ => check(t))
  })

  t.end()
})

t.test('mode', t => {
  const p = join(__dirname, '/mode')

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'ok')
    t.equal(
      fs.statSync(p).mode & 0o777,
      process.platform === 'win32' ? 0o666 : 0o700,
    )
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    new WriteStreamSync(p, { mode: 0o700 }).end('ok')
    check(t)
  })

  t.test('async', t => {
    const s = new WriteStream(p, { mode: 0o700 })
    s.end('ok')
    s.on('finish', _ => check(t))
  })

  t.end()
})

t.test('write after end', t => {
  const p = join(__dirname, '/write-after-end')

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'ok')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    const s = new WriteStreamSync(p, { mode: 0o700 })
    s.end('ok')
    t.throws(
      _ => s.write('626164', 'hex'),
      new Error('write() after end()'),
    )
    check(t)
  })

  t.test('async', t => {
    const s = new WriteStream(p, { mode: 0o700 })
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
  const p = join(__dirname, '/fd')

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), 'ok')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    const fd = fs.openSync(p, 'w')
    new WriteStreamSync(p, { fd: fd }).end('ok')
    check(t)
  })

  t.test('async', t => {
    const fd = fs.openSync(p, 'w')
    const s = new WriteStream(p, { fd: fd })
    s.end('ok')
    s.on('finish', _ => check(t))
  })

  t.end()
})

t.test('empty write', t => {
  const p = join(__dirname, '/empty-write')

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), '')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    t.test('empty string', t => {
      new WriteStreamSync(p).end('')
      check(t)
    })
    t.test('no chunk to end', t => {
      new WriteStreamSync(p).end('')
      check(t)
    })
    t.end()
  })

  return t.test('async', t => {
    t.test('immediate', t => {
      t.test('no chunk to end', t => {
        const s = new WriteStream(p)
        s.end()
        s.on('finish', _ => check(t))
      })

      return t.test('empty string', t => {
        const s = new WriteStream(p)
        s.end('')
        s.on('finish', _ => check(t))
      })
    })

    return t.test('end on open', t => {
      t.test('no chunk to end', t => {
        const s = new WriteStream(p)
        s.on('open', _ => s.end())
        s.on('finish', _ => check(t))
      })

      return t.test('empty string', t => {
        const s = new WriteStream(p)
        s.on('open', _ => s.end(''))
        s.on('finish', _ => check(t))
      })
    })
  })
})

t.test('fail open', t => {
  const p = join(__dirname, '/fail-open')
  const poop = new Error('poop')
  t.teardown(mutateFS.fail('open', poop))
  t.throws(_ => new WriteStreamSync(p), poop)
  const str = new WriteStream(p)
  str.on('error', er => {
    t.equal(er, poop)
    t.end()
  })
})

t.test('fail open, positioned write', t => {
  const p = join(__dirname, '/fail-open-positioned')
  const poop = new Error('poop')
  t.teardown(mutateFS.fail('open', poop))
  t.throws(_ => new WriteStreamSync(p, { start: 2 }), poop)
  const str = new WriteStream(p, { start: 2 })
  str.on('error', er => {
    t.equal(er, poop)
    t.end()
  })
})

t.test('fail close', t => {
  const p = join(__dirname, '/fail-close')
  const poop = new Error('poop')
  t.teardown(mutateFS.fail('close', poop))
  t.teardown(() => fs.unlinkSync(p))
  t.throws(_ => new WriteStreamSync(p).end('asdf'), poop)
  const str = new WriteStream(p).end('asdf')
  str.on('error', er => {
    t.equal(er, poop)
    t.end()
  })
})

t.test('fail write', t => {
  // also fail close, just to exercise the double-error logic
  const closeError = new Error('close error')
  t.teardown(mutateFS.fail('close', closeError))

  const p = join(__dirname, '/fail-write')
  const poop = new Error('poop')
  t.teardown(mutateFS.fail('write', poop))

  t.throws(_ => new WriteStreamSync(p).write('foo'), poop)
  const str = new WriteStream(p)
  str.write('foo')
  str.on('error', er => {
    t.equal(er, poop)
    fs.unlinkSync(p)
    t.end()
  })
})

t.test('positioned write', t => {
  const p = join(__dirname, '/positioned-write')
  const write = Buffer.from('this is the data that is written')

  const data = Buffer.allocUnsafe(256)
  for (let i = 0; i < 256; i++) {
    data[i] = i
  }

  const expect = Buffer.from(data.toString('hex'), 'hex')
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
    new WriteStreamSync(p, { start: 100 }).end(write)
    check(t)
  })

  t.test('async', t => {
    fs.writeFileSync(p, data)
    const s = new WriteStream(p, { start: 100 })
    s.end(write)
    s.on('finish', _ => check(t))
  })

  t.end()
})

t.test('positioned then unpositioned', t => {
  const p = join(__dirname, '/positioned-then-unpositioned')
  const write = Buffer.from('this is the data that is written')

  const data = Buffer.allocUnsafe(256)
  for (let i = 0; i < 256; i++) {
    data[i] = i
  }

  const expect = Buffer.from(data.toString('hex'), 'hex')
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
    const s = new WriteStreamSync(p, { start: 100 })
    s.write(write.subarray(0, 20))
    s.end(write.subarray(20))
    check(t)
  })

  t.test('async', t => {
    fs.writeFileSync(p, data)
    const s = new WriteStream(p, { start: 100 })
    s.write(write.subarray(0, 20))
    s.end(write.subarray(20))
    s.on('close', _ => check(t))
  })

  t.end()
})

t.test('positioned then unpositioned at zero', t => {
  const p = join(__dirname, '/positioned-then-unpositioned')
  const write = Buffer.from('this is the data that is written')

  const data = Buffer.allocUnsafe(256)
  for (let i = 0; i < 256; i++) {
    data[i] = i
  }

  const expect = Buffer.from(data.toString('hex'), 'hex')
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
    const s = new WriteStreamSync(p, { start: 0 })
    s.write(write.subarray(0, 20))
    s.end(write.subarray(20))
    check(t)
  })

  t.test('async', t => {
    fs.writeFileSync(p, data)
    const s = new WriteStream(p, { start: 0 })
    s.write(write.subarray(0, 20))
    s.end(write.subarray(20))
    s.on('close', _ => check(t))
  })

  t.end()
})

t.test('fd, no autoClose', t => {
  const p = join(__dirname, '/fd-no-autoclose')

  const check = (t, fd) => {
    fs.closeSync(fd)
    t.equal(fs.readFileSync(p, 'utf8'), 'ok')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    const fd = fs.openSync(p, 'w')
    new WriteStreamSync(p, { fd: fd, autoClose: false }).end('ok')
    check(t, fd)
  })

  t.test('async', t => {
    const fd = fs.openSync(p, 'w')
    const s = new WriteStream(p, { fd: fd, autoClose: false })
    s.end('ok')
    s.on('finish', _ => check(t, fd))
  })

  t.end()
})

t.test('positioned, nonexistent file', t => {
  const p = join(__dirname, '/pos-noent')

  const check = t => {
    t.equal(fs.readFileSync(p, 'utf8'), '\0\0asdf\0\0\0\0asdf')
    fs.unlinkSync(p)
    t.end()
  }

  t.test('sync', t => {
    const w = new WriteStreamSync(p, { start: 10 })
    w.end('asdf')
    const w2 = new WriteStreamSync(p, { start: 2 })
    w2.end('asdf')
    check(t)
  })

  t.test('async', t => {
    const w = new WriteStream(p, { start: 10 })
    w.end('asdf')
    w.on('close', _ => {
      const w2 = new WriteStream(p, { start: 2 })
      w2.end('asdf')
      w2.on('close', () => check(t))
    })
  })

  t.end()
})
