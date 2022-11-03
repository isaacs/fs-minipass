/// <reference types="node" />
import Minipass, { Encoding } from 'minipass'
import type { Mode } from 'node:fs'

export class ReadStream extends Minipass {
  constructor(
    path: string,
    options?: {
      fd?: number
      readSize?: number
      size?: number
      autoClose: boolean
    }
  )

  get fd(): number
  get path(): string

  readable: false
  writeable: true
}

export class ReadStreamSync extends ReadStream {}

export class WriteStream extends Minipass {
  constructor(
    path: string,
    options?: {
      fd?: number
      mode?: Mode
      start?: number
      autoClose?: boolean
      flags?: string
    }
  )

  get fd(): number
  get path(): string

  end(cb?: () => void): never
  end(chunk: any, cb?: () => void): never
  end(chunk: any, encoding?: Encoding, cb?: () => void): never
  end(buf: Buffer | string, enc: BufferEncoding, cb?: () => void): this

  write(chunk: any, cb?: () => void): never
  write(chunk: any, encoding?: Encoding, cb?: () => void): never
  write(buf: Buffer | string, enc: BufferEncoding): boolean
}

export class WriteStreamSync extends WriteStream {}
