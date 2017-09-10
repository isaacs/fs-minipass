'use strict'
const MiniPass = require('minipass')
const fs = require('fs')

const _readSize = Symbol('_readSize')
const _fd = Symbol('_fd')
const _path = Symbol('_path')
const _read = Symbol('_read')
const _reading = Symbol('_reading')
const _onread = Symbol('_onread')
const _open = Symbol('_open')
const _onopen = Symbol('_onopen')
const _handleChunk = Symbol('_handleChunk')
const _close = Symbol('_close')
const _onerror = Symbol('_onerror')
const _makeBuf = Symbol('_makeBuf')

class ReadStream extends MiniPass {
  constructor (path, opt) {
    opt = opt || {}
    super(opt)

    this.writable = false

    if (typeof path !== 'string')
      throw new TypeError('path must be a string')

    this.id = Math.random()
    this[_fd] = typeof opt.fd === 'number' ? opt.fd : null
    this[_path] = path
    this[_readSize] = opt.readSize || 16*1024*1024
    this[_reading] = false

    if (typeof this[_fd] === 'number')
      this[_read]()
    else
      this[_open]()
  }

  get fd () { return this[_fd] }
  get path () { return this[_path] }

  write () {
    throw new TypeError('this is a readable stream')
  }

  end () {
    throw new TypeError('this is a readable stream')
  }

  [_open] () {
    fs.open(this[_path], 'r', (er, fd) => this[_onopen](er, fd))
  }

  [_onopen] (er, fd) {
    if (er)
      this[_onerror](er)
    else {
      this[_fd] = fd
      this.emit('open', fd)
      this[_read]()
    }
  }

  [_makeBuf] () {
    return Buffer.allocUnsafe(this[_readSize])
  }

  [_read] () {
    if (!this[_reading]) {
      this[_reading] = true
      const buf = this[_makeBuf]()
      fs.read(this[_fd], buf, 0, buf.length, null, (er, br, buf) =>
        this[_onread](er, br, buf))
    }
  }

  [_onread] (er, br, buf) {
    this[_reading] = false
    if (er)
      this[_onerror](er)
    else if (this[_handleChunk](br, buf))
      this[_read]()
  }

  [_close] () {
    fs.close(this[_fd], _ => _)
    this[_fd] = null
  }

  [_onerror] (er) {
    this[_reading] = true
    if (typeof this[_fd] === 'number')
      this[_close]()
    this.emit('error', er)
  }

  [_handleChunk] (br, buf) {
    let ret = false
    if (br === 0) {
      this[_close]()
      super.end()
    } else
      ret = super.write(br < buf.length ? buf.slice(0, br) : buf)
    return ret
  }

  emit (ev, data) {
    switch (ev) {
      case 'prefinish':
      case 'finish':
        break

      case 'drain':
        if (typeof this[_fd] === 'number')
          this[_read]()
        break

      default:
        return super.emit(ev, data)
    }
  }
}

class ReadStreamSync extends ReadStream {
  [_open] () {
    let threw = true
    try {
      this[_onopen](null, fs.openSync(this[_path], 'r'))
      threw = false
    } finally {
      if (threw)
        this[_close]()
    }
  }

  [_read] () {
    let threw = true
    try {
      if (!this[_reading]) {
        this[_reading] = true
        do {
          const buf = this[_makeBuf]()
          const br = fs.readSync(this[_fd], buf, 0, buf.length, null)
          if (!this[_handleChunk](br, buf))
            break
        } while (true)
        this[_reading] = false
      }
      threw = false
    } finally {
      if (threw)
        this[_close]()
    }
  }

  [_close] () {
    try {
      fs.closeSync(this[_fd])
    } catch (er) {}
    this[_fd] = null
  }
}

class WriteStream extends MiniPass {

}

class WriteStreamSync extends WriteStream {

}

exports.ReadStream = ReadStream
exports.ReadStreamSync = ReadStreamSync

exports.WriteStream = WriteStream
exports.WriteStreamSync = WriteStreamSync
