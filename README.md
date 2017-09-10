# fs-minipass

Filesystem streams based on [minipass](http://npm.im/minipass).

4 classes are exported:

- ReadStream
- ReadStreamSync
- WriteStream
- WriteStreamSync

When using `ReadStreamSync`, all of the data is made available
immediately upon consuming the stream.  Nothing is buffered in memory
when the stream is constructed.  If the stream is piped to a writer,
then it will synchronously `read()` and emit data into the writer as
fast as the writer can consume it.  (That is, it will respect
backpressure.)  If you call `stream.read()` then it will read the
entire file and return the contents.

When using `WriteStreamSync`, every write is flushed to the file
synchronously.  If your writes all come in a single tick, then it'll
write it all out in a single tick.  It's as synchronous as you are.

The async versions work much like their node builtin counterparts,
with the exception of introducing significantly less Stream machinery
overhead.

## USAGE

It's just streams, you pipe them or read() them or write() to them.

```js
const fsm = require('fs-minipass')
const readStream = new fsm.ReadStream('file.txt')
const writeStream = new fsm.WriteStream('output.txt')
writeStream.write('some file header or whatever\n')
readStream.pipe(writeStream)
```
