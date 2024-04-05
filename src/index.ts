import EE from 'events'
import fs from 'fs'
import { Minipass } from 'minipass'

const writev = fs.writev

const _autoClose = Symbol('_autoClose')
const _close = Symbol('_close')
const _ended = Symbol('_ended')
const _fd = Symbol('_fd')
const _finished = Symbol('_finished')
const _flags = Symbol('_flags')
const _flush = Symbol('_flush')
const _handleChunk = Symbol('_handleChunk')
const _makeBuf = Symbol('_makeBuf')
const _mode = Symbol('_mode')
const _needDrain = Symbol('_needDrain')
const _onerror = Symbol('_onerror')
const _onopen = Symbol('_onopen')
const _onread = Symbol('_onread')
const _onwrite = Symbol('_onwrite')
const _open = Symbol('_open')
const _path = Symbol('_path')
const _pos = Symbol('_pos')
const _queue = Symbol('_queue')
const _read = Symbol('_read')
const _readSize = Symbol('_readSize')
const _reading = Symbol('_reading')
const _remain = Symbol('_remain')
const _size = Symbol('_size')
const _write = Symbol('_write')
const _writing = Symbol('_writing')
const _defaultFlag = Symbol('_defaultFlag')
const _errored = Symbol('_errored')

export type ReadStreamOptions =
  Minipass.Options<Minipass.ContiguousData> & {
    fd?: number
    readSize?: number
    size?: number
    autoClose?: boolean
  }

export type ReadStreamEvents = Minipass.Events<Minipass.ContiguousData> & {
  open: [fd: number]
}

export class ReadStream extends Minipass<
  Minipass.ContiguousData,
  Buffer,
  ReadStreamEvents
> {
  [_errored]: boolean = false;
  [_fd]?: number;
  [_path]: string;
  [_readSize]: number;
  [_reading]: boolean = false;
  [_size]: number;
  [_remain]: number;
  [_autoClose]: boolean

  constructor(path: string, opt: ReadStreamOptions) {
    opt = opt || {}
    super(opt)

    this.readable = true
    this.writable = false

    if (typeof path !== 'string') {
      throw new TypeError('path must be a string')
    }

    this[_errored] = false
    this[_fd] = typeof opt.fd === 'number' ? opt.fd : undefined
    this[_path] = path
    this[_readSize] = opt.readSize || 16 * 1024 * 1024
    this[_reading] = false
    this[_size] = typeof opt.size === 'number' ? opt.size : Infinity
    this[_remain] = this[_size]
    this[_autoClose] =
      typeof opt.autoClose === 'boolean' ? opt.autoClose : true

    if (typeof this[_fd] === 'number') {
      this[_read]()
    } else {
      this[_open]()
    }
  }

  get fd() {
    return this[_fd]
  }

  get path() {
    return this[_path]
  }

  //@ts-ignore
  write() {
    throw new TypeError('this is a readable stream')
  }

  //@ts-ignore
  end() {
    throw new TypeError('this is a readable stream')
  }

  [_open]() {
    fs.open(this[_path], 'r', (er, fd) => this[_onopen](er, fd))
  }

  [_onopen](er?: NodeJS.ErrnoException | null, fd?: number) {
    if (er) {
      this[_onerror](er)
    } else {
      this[_fd] = fd
      this.emit('open', fd as number)
      this[_read]()
    }
  }

  [_makeBuf]() {
    return Buffer.allocUnsafe(Math.min(this[_readSize], this[_remain]))
  }

  [_read]() {
    if (!this[_reading]) {
      this[_reading] = true
      const buf = this[_makeBuf]()
      /* c8 ignore start */
      if (buf.length === 0) {
        return process.nextTick(() => this[_onread](null, 0, buf))
      }
      /* c8 ignore stop */
      fs.read(this[_fd] as number, buf, 0, buf.length, null, (er, br, b) =>
        this[_onread](er, br, b),
      )
    }
  }

  [_onread](er?: NodeJS.ErrnoException | null, br?: number, buf?: Buffer) {
    this[_reading] = false
    if (er) {
      this[_onerror](er)
    } else if (this[_handleChunk](br as number, buf as Buffer)) {
      this[_read]()
    }
  }

  [_close]() {
    if (this[_autoClose] && typeof this[_fd] === 'number') {
      const fd = this[_fd]
      this[_fd] = undefined
      fs.close(fd, er =>
        er ? this.emit('error', er) : this.emit('close'),
      )
    }
  }

  [_onerror](er: NodeJS.ErrnoException) {
    this[_reading] = true
    this[_close]()
    this.emit('error', er)
  }

  [_handleChunk](br: number, buf: Buffer) {
    let ret = false
    // no effect if infinite
    this[_remain] -= br
    if (br > 0) {
      ret = super.write(br < buf.length ? buf.subarray(0, br) : buf)
    }

    if (br === 0 || this[_remain] <= 0) {
      ret = false
      this[_close]()
      super.end()
    }

    return ret
  }

  emit<Event extends keyof ReadStreamEvents>(
    ev: Event,
    ...args: ReadStreamEvents[Event]
  ): boolean {
    switch (ev) {
      case 'prefinish':
      case 'finish':
        return false

      case 'drain':
        if (typeof this[_fd] === 'number') {
          this[_read]()
        }
        return false

      case 'error':
        if (this[_errored]) {
          return false
        }
        this[_errored] = true
        return super.emit(ev, ...args)

      default:
        return super.emit(ev, ...args)
    }
  }
}

export class ReadStreamSync extends ReadStream {
  [_open]() {
    let threw = true
    try {
      this[_onopen](null, fs.openSync(this[_path], 'r'))
      threw = false
    } finally {
      if (threw) {
        this[_close]()
      }
    }
  }

  [_read]() {
    let threw = true
    try {
      if (!this[_reading]) {
        this[_reading] = true
        do {
          const buf = this[_makeBuf]()
          /* c8 ignore start */
          const br =
            buf.length === 0
              ? 0
              : fs.readSync(this[_fd] as number, buf, 0, buf.length, null)
          /* c8 ignore stop */
          if (!this[_handleChunk](br, buf)) {
            break
          }
        } while (true)
        this[_reading] = false
      }
      threw = false
    } finally {
      if (threw) {
        this[_close]()
      }
    }
  }

  [_close]() {
    if (this[_autoClose] && typeof this[_fd] === 'number') {
      const fd = this[_fd]
      this[_fd] = undefined
      fs.closeSync(fd)
      this.emit('close')
    }
  }
}

export type WriteStreamOptions = {
  fd?: number
  autoClose?: boolean
  mode?: number
  captureRejections?: boolean
  start?: number
  flags?: string
}

export class WriteStream extends EE {
  readable: false = false
  writable: boolean = true;
  [_errored]: boolean = false;
  [_writing]: boolean = false;
  [_ended]: boolean = false;
  [_queue]: Buffer[] = [];
  [_needDrain]: boolean = false;
  [_path]: string;
  [_mode]: number;
  [_autoClose]: boolean;
  [_fd]?: number;
  [_defaultFlag]: boolean;
  [_flags]: string;
  [_finished]: boolean = false;
  [_pos]?: number

  constructor(path: string, opt: WriteStreamOptions) {
    opt = opt || {}
    super(opt)
    this[_path] = path
    this[_fd] = typeof opt.fd === 'number' ? opt.fd : undefined
    this[_mode] = opt.mode === undefined ? 0o666 : opt.mode
    this[_pos] = typeof opt.start === 'number' ? opt.start : undefined
    this[_autoClose] =
      typeof opt.autoClose === 'boolean' ? opt.autoClose : true

    // truncating makes no sense when writing into the middle
    const defaultFlag = this[_pos] !== undefined ? 'r+' : 'w'
    this[_defaultFlag] = opt.flags === undefined
    this[_flags] = opt.flags === undefined ? defaultFlag : opt.flags

    if (this[_fd] === undefined) {
      this[_open]()
    }
  }

  emit(ev: string, ...args: any[]) {
    if (ev === 'error') {
      if (this[_errored]) {
        return false
      }
      this[_errored] = true
    }
    return super.emit(ev, ...args)
  }

  get fd() {
    return this[_fd]
  }

  get path() {
    return this[_path]
  }

  [_onerror](er: NodeJS.ErrnoException) {
    this[_close]()
    this[_writing] = true
    this.emit('error', er)
  }

  [_open]() {
    fs.open(this[_path], this[_flags], this[_mode], (er, fd) =>
      this[_onopen](er, fd),
    )
  }

  [_onopen](er?: null | NodeJS.ErrnoException, fd?: number) {
    if (
      this[_defaultFlag] &&
      this[_flags] === 'r+' &&
      er &&
      er.code === 'ENOENT'
    ) {
      this[_flags] = 'w'
      this[_open]()
    } else if (er) {
      this[_onerror](er)
    } else {
      this[_fd] = fd
      this.emit('open', fd)
      if (!this[_writing]) {
        this[_flush]()
      }
    }
  }

  end(buf: string, enc?: BufferEncoding): this
  end(buf: Buffer, enc?: undefined): this
  end(buf: Buffer | string, enc?: BufferEncoding): this {
    if (buf) {
      //@ts-ignore
      this.write(buf, enc)
    }

    this[_ended] = true

    // synthetic after-write logic, where drain/finish live
    if (
      !this[_writing] &&
      !this[_queue].length &&
      typeof this[_fd] === 'number'
    ) {
      this[_onwrite](null, 0)
    }
    return this
  }

  write(buf: string, enc?: BufferEncoding): boolean
  write(buf: Buffer, enc?: undefined): boolean
  write(buf: Buffer | string, enc?: BufferEncoding): boolean {
    if (typeof buf === 'string') {
      buf = Buffer.from(buf, enc)
    }

    if (this[_ended]) {
      this.emit('error', new Error('write() after end()'))
      return false
    }

    if (this[_fd] === undefined || this[_writing] || this[_queue].length) {
      this[_queue].push(buf)
      this[_needDrain] = true
      return false
    }

    this[_writing] = true
    this[_write](buf)
    return true
  }

  [_write](buf: Buffer) {
    fs.write(
      this[_fd] as number,
      buf,
      0,
      buf.length,
      this[_pos],
      (er, bw) => this[_onwrite](er, bw),
    )
  }

  [_onwrite](er?: null | NodeJS.ErrnoException, bw?: number) {
    if (er) {
      this[_onerror](er)
    } else {
      if (this[_pos] !== undefined && typeof bw === 'number') {
        this[_pos] += bw
      }
      if (this[_queue].length) {
        this[_flush]()
      } else {
        this[_writing] = false

        if (this[_ended] && !this[_finished]) {
          this[_finished] = true
          this[_close]()
          this.emit('finish')
        } else if (this[_needDrain]) {
          this[_needDrain] = false
          this.emit('drain')
        }
      }
    }
  }

  [_flush]() {
    if (this[_queue].length === 0) {
      if (this[_ended]) {
        this[_onwrite](null, 0)
      }
    } else if (this[_queue].length === 1) {
      this[_write](this[_queue].pop() as Buffer)
    } else {
      const iovec = this[_queue]
      this[_queue] = []
      writev(this[_fd] as number, iovec, this[_pos] as number, (er, bw) =>
        this[_onwrite](er, bw),
      )
    }
  }

  [_close]() {
    if (this[_autoClose] && typeof this[_fd] === 'number') {
      const fd = this[_fd]
      this[_fd] = undefined
      fs.close(fd, er =>
        er ? this.emit('error', er) : this.emit('close'),
      )
    }
  }
}

export class WriteStreamSync extends WriteStream {
  [_open](): void {
    let fd
    // only wrap in a try{} block if we know we'll retry, to avoid
    // the rethrow obscuring the error's source frame in most cases.
    if (this[_defaultFlag] && this[_flags] === 'r+') {
      try {
        fd = fs.openSync(this[_path], this[_flags], this[_mode])
      } catch (er) {
        if ((er as NodeJS.ErrnoException)?.code === 'ENOENT') {
          this[_flags] = 'w'
          return this[_open]()
        } else {
          throw er
        }
      }
    } else {
      fd = fs.openSync(this[_path], this[_flags], this[_mode])
    }

    this[_onopen](null, fd)
  }

  [_close]() {
    if (this[_autoClose] && typeof this[_fd] === 'number') {
      const fd = this[_fd]
      this[_fd] = undefined
      fs.closeSync(fd)
      this.emit('close')
    }
  }

  [_write](buf: Buffer) {
    // throw the original, but try to close if it fails
    let threw = true
    try {
      this[_onwrite](
        null,
        fs.writeSync(this[_fd] as number, buf, 0, buf.length, this[_pos]),
      )
      threw = false
    } finally {
      if (threw) {
        try {
          this[_close]()
        } catch {
          // ok error
        }
      }
    }
  }
}
