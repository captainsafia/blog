---
layout: post
title: 'Node module deep-dive: WriteableStream'
date: '2017-11-20T10:00:50-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/167700208169/node-module-deep-dive-writeablestream
---
Here we go again! I’m doing another Node module deep-dive on the ol’ bloggity blog today. I figured I would dive into the `WriteableStreams` object. `WriteableStreams` expose methods that allow you to write to a stream. They expose multiple events like `close`, `drain`, and `pipe` and several functions like `cork`, `end`, and `write`. Before I dive into the `WriteableStream` object, it helps to provide a [quick primer on the concept of streams](https://medium.freecodecamp.org/node-js-streams-everything-you-need-to-know-c9141306be93).

Alright! Now that we’ve got that foundation set up, it’s time to dive into the code. I’ll be doing a code walkthrough of [this version](https://github.com/nodejs/node/blob/9531fcbb2e447c6a5ef0366c5446e10f90073cb5/lib/_stream_writable.js) of the `WritableStream`. As I skimmed through the file, I was glad to find out that there were quite a few comments sprinkled throughout the code base to clarify what different parts of the library did. These explanatory comments made reading through the codebase much easier to parse through the code. The first thing that I did was examine the properties [that were defined on the WriteableState object](https://github.com/nodejs/node/blob/9531fcbb2e447c6a5ef0366c5446e10f90073cb5/lib/_stream_writable.js#L45-L154). The comments in the code base do a pretty good job of describing what each of the properties are, so I’ll avoid going into detail on them here. From reading the code, it appears that the `WritableState` object holds information about the current `WriteableStream` (that makes sense!).

There’s single function defined on the `WriteableState` that is designed to get the current buffer on the `Writeable` as a list.

    WritableState.prototype.getBuffer = function getBuffer() {
      var current = this.bufferedRequest;
      var out = [];
      while (current) {
        out.push(current);
        current = current.next;
      }
      return out;
    };

The definition of the `Writable` stream outlines a few properties on the function. Namely, the programmer can specify special `write`, `destroy`, and `final` functions to the `Writable`.

    function Writable(options) {
      // Writable ctor is applied to Duplexes, too.
      // `realHasInstance` is necessary because using plain `instanceof`
      // would return false, as no `_writableState` property is attached.
    
      // Trying to use the custom `instanceof` for Writable here will also break the
      // Node.js LazyTransform implementation, which has a non-trivial getter for
      // `_writableState` that would lead to infinite recursion.
      if (!(realHasInstance.call(Writable, this)) &&
          !(this instanceof Stream.Duplex)) {
        return new Writable(options);
      }
    
      this._writableState = new WritableState(options, this);
    
      // legacy.
      this.writable = true;
    
      if (options) {
        if (typeof options.write === 'function')
          this._write = options.write;
    
        if (typeof options.writev === 'function')
          this._writev = options.writev;
    
        if (typeof options.destroy === 'function')
          this._destroy = options.destroy;
    
        if (typeof options.final === 'function')
          this._final = options.final;
      }
    
      Stream.call(this);
    }

The first function defined on the `Writeable` prototype introduces a rather whimsical comment.

    // Otherwise people can pipe Writable streams, which is just wrong.
    Writable.prototype.pipe = function() {
      this.emit('error', new errors.Error('ERR_STREAM_CANNOT_PIPE'));
    };

You can’t read from a `Writeable` stream so of course it doesn’t make sense that you’d be able to pipe the output from a `WriteableStream` since it doesn’t exist in the first place.

The `write` function is defined next. It takes three parameters: a `chunk` of data to write, the `encoding` of the data, and a `cb` (callback) to be executed once the write is done.

    Writable.prototype.write = function(chunk, encoding, cb) {
      var state = this._writableState;
      var ret = false;
      var isBuf = !state.objectMode && Stream._isUint8Array(chunk);
    
      if (isBuf && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
        chunk = Stream._uint8ArrayToBuffer(chunk);
      }
    
      if (typeof encoding === 'function') {
        cb = encoding;
        encoding = null;
      }
    
      if (isBuf)
        encoding = 'buffer';
      else if (!encoding)
        encoding = state.defaultEncoding;
    
      if (typeof cb !== 'function')
        cb = nop;
    
      if (state.ended)
        writeAfterEnd(this, cb);
      else if (isBuf || validChunk(this, state, chunk, cb)) {
        state.pendingcb++;
        ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
      }
    
      return ret;
    };

The function grabs the current state of the `WritableStream` and checks to see if the data being written to the stream consists of Buffers or Objects and stores this distinction in `isBuf`. If the data being written to the stream is expected to be a `Buffer` but the `chunk` passed is not a `Buffer`, the function assumes it is an integer array and converts it to a `Buffer`. After that, there is some logic that makes sure that parameters are mapped properly. Namely, the user doesn’t have to pass an `encoding` parameter to the function. When this is the case, the second argument passed is actually the callback to be called. If the stream has been ended, the function will call a `writeAfterEnd` function which will emit an error to the user since you can’t write to a stream that has been closed.

    function writeAfterEnd(stream, cb) {
      var er = new errors.Error('ERR_STREAM_WRITE_AFTER_END');
      // TODO: defer error events consistently everywhere, not just the cb
      stream.emit('error', er);
      process.nextTick(cb, er);
    }

Otherwise, if the data is a buffer the function will invoke a `writeOrBuffer` function.

    // if we're already writing something, then just put this
    // in the queue, and wait our turn. Otherwise, call _write
    // If we return false, then we need a drain event, so set that flag.
    function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
      if (!isBuf) {
        var newChunk = decodeChunk(state, chunk, encoding);
        if (chunk !== newChunk) {
          isBuf = true;
          encoding = 'buffer';
          chunk = newChunk;
        }
      }
      var len = state.objectMode ? 1 : chunk.length;
    
      state.length += len;
    
      var ret = state.length < state.highWaterMark;
      // we must ensure that previous needDrain will not be reset to false.
      if (!ret)
        state.needDrain = true;
    
      if (state.writing || state.corked) {
        var last = state.lastBufferedRequest;
        state.lastBufferedRequest = {
          chunk,
          encoding,
          isBuf,
          callback: cb,
          next: null
        };
        if (last) {
          last.next = state.lastBufferedRequest;
        } else {
          state.bufferedRequest = state.lastBufferedRequest;
        }
        state.bufferedRequestCount += 1;
      } else {
        doWrite(stream, state, false, len, chunk, encoding, cb);
      }
    
      return ret;
    }
    

There is a lot going on here so let’s step through it bit-by-bit. The first couple of lines in the function check to see if `chunk` passed is not a Buffer. If it is not, the `chunk` is decoded using the `decodeChunk`, which creates a chunk from a string using the `Buffer.from` function.

    function decodeChunk(state, chunk, encoding) {
      if (!state.objectMode &&
          state.decodeStrings !== false &&
          typeof chunk === 'string') {
        chunk = Buffer.from(chunk, encoding);
      }
      return chunk;
    }

It then checks to see if the capacity of the stream has been reached by evaluating if the length of the stream has exceeded the `highWaterMark` and sets the `needDrain` parameter appropriately. Afterwards, it updates the value of the `lastBufferedRequest` stored in the state to the Buffer that was passed as a parameter and calls the `doWrite` function which writes the chunk to the stream.

The next functions defined are the `cork` and `uncork` function which are defined as follows. The cork function increments the `corked` counter. The `corked` counter actually acts as a Boolean, when it has a non-zero value it means there are writes that will need to be buffered. The `uncork` function decrements the `corked` parameter and clears the buffer.

     Writable.prototype.cork = function() {
      var state = this._writableState;
    
      state.corked++;
    };
    
    Writable.prototype.uncork = function() {
      var state = this._writableState;
    
      if (state.corked) {
        state.corked--;
    
        if (!state.writing &&
            !state.corked &&
            !state.finished &&
            !state.bufferProcessing &&
            state.bufferedRequest)
          clearBuffer(this, state);
      }
    }

There next function is a short and sweat function that allows the user to set the default encoding on the `WriteableStream` or raising an error if the user provides an invalid encoding.

    Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
      // node::ParseEncoding() requires lower case.
      if (typeof encoding === 'string')
        encoding = encoding.toLowerCase();
      if (!Buffer.isEncoding(encoding))
        throw new errors.TypeError('ERR_UNKNOWN_ENCODING', encoding);
      this._writableState.defaultEncoding = encoding;
      return this;
    };

The `end` function is called when the last `chunk` needs to be written to the stream. It writes the chunk by invoking the `write` function that we explored above, uncorks it fully, and clears out the `WritableState` by invoking `endWriteable.`

    Writable.prototype.end = function(chunk, encoding, cb) {
      var state = this._writableState;
    
      if (typeof chunk === 'function') {
        cb = chunk;
        chunk = null;
        encoding = null;
      } else if (typeof encoding === 'function') {
        cb = encoding;
        encoding = null;
      }
    
      if (chunk !== null && chunk !== undefined)
        this.write(chunk, encoding);
    
      // .end() fully uncorks
      if (state.corked) {
        state.corked = 1;
        this.uncork();
      }
    
      // ignore unnecessary end() calls.
      if (!state.ending && !state.finished)
        endWritable(this, state, cb);
    };

And that’s that! I went through and read through the main portions of the `WriteableStream` object. I’ll admit that prior to reading the code dilligently, I was a little overwhelmed by everything that was going on under the hood. Going through and reading the code function-by-function definitely cleared up a lot of things for me.

If you have any questions or comments about the above, feel free to [ask me a question](https://blog.safia.rocks/ask) or [reach out to me on Twitter](https://twitter.com/captainsafia).

