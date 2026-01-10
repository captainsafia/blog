---
layout: post
title: 'Node module deep-dive: Buffer'
date: '2017-12-04T01:50:11-08:00'
tags:
- node-module-deep-dive
tumblr_url: https://blog.safia.rocks/post/168178033965/node-module-deep-dive-buffer
---
Howdy there! Time for another installment of my Node module-deep dive series! This week, I’m diving into the Buffer object in Node. I’ll admit that when I opened up the file for an initial look-through I freaked out a little bit. It’s a whooping 1,599 lines of code (give or take some for the lines that consist of comments). But you know what? I’ve done enough of these read-throughs to not be intimidated so onwards I go.

Before I dive into the actual code, it might help to present a quick primer on Buffers. Buffers in Node make it possible for the developer to interact with streams of binary data, this is particularly useful for things like reading and writing to a file on the filesystem. If you’ve used functions in the `fs` module like `fs.createReadStream` or `fs.createWriteStream`, you’ve interacted with buffers. To give an example, here is a Buffer containing a representation of the word “Safia” in Node.

    > Buffer.from("Safia")
    <Buffer 53 61 66 69 61>

Alright! Time to get into the nitty-gritty and look at the code itself. As usual, [here](https://github.com/nodejs/node/blob/9fb390a1c66c91796626fe199176619ce4a54f62/lib/buffer.js) is a permalink to the particular version of the `Buffer` class that I’ll be looking through. I usually start my code read at the _bottom_ of a file to determine what classes and APIs a particular module exposes. Here’s a look at what the Buffer module exports.

    module.exports = exports = {
      Buffer,
      SlowBuffer,
      transcode,
      INSPECT_MAX_BYTES: 50,
    
      // Legacy
      kMaxLength,
      kStringMaxLength
    };

So it looks like it exports two classes, a `Buffer` and a `SlowBuffer`. I’m not sure what the specification distinction between them is at the moment, besides the obvious difference that one of them is slow and the other is not. In addition to those class exports, it looks like the module also exports several constants and a function.

The first thing I wanted to do was figure out what a `SlowBuffer` was and why it existed in the codebase. I headed over to the documentation page on `Buffer` under the latest version of Node and discovered under the [section for the `SlowBuffer` class](https://nodejs.org/api/buffer.html#buffer_class_slowbuffer) that it was actually a deprecated. A `SlowBuffer` is actually a variant of a `Buffer` object that is unpooled. An unpooled Buffer is one in which memory has not been initialized for the Buffer instance.

Now that I understood that, I started to look through the code for the `Buffer` class itself. The class exposes a lot of functions, so I wanted to focus on the few that I used in my day-to-day development work.

First, I wanted to start off by taking a look at the `Buffer.from` method. `Buffer.from` allows the developer to create a `Buffer` object from a string, array, or another `Buffer`. The method definition requires that the developer provide a `value`, `encodingOrOffeset`, and `length` parameters. The second two parameters only apply if the `value` that the developer is passing is an array, in which case they represent the index of the first byte in the array that the `Buffer` object will expose and the total number of bytes in the `Buffer` object to expose. If the `value` is a string, the second parameter is the encoding of the string (UTF-8 or ASCII, for example).

    Buffer.from = function from(value, encodingOrOffset, length) {

The first couple of lines of code in the function define what to do when the type of the `value` is a string or an array. The method invokes the `fromString` and `fromArrayBuffer` functions accordingly.

    if (typeof value === 'string')
      return fromString(value, encodingOrOffset);
    
    if (isAnyArrayBuffer(value))
      return fromArrayBuffer(value, encodingOrOffset, length);

I decided to look at the `fromString` function first. Its function definition requires a `string` and an `encoding` as explained above.

    function fromString(string, encoding) {

The function starts by handling potential edge cases in the parameters provided by the developer. For example, if the user doesn’t provide a string or an encoding, the function returns an empty Buffer.

      if (typeof encoding !== 'string' || encoding.length === 0) {
        if (string.length === 0)
          return new FastBuffer();

If the developer doesn’t provide an encoding, the function falls back on UTF-8 as the default encoding. The `length` variable defines the number of bytes in the string assuming it is encoding in UTF-8.

    encoding = 'utf8';
    length = byteLengthUtf8(string);

The next if-statement checks to see if the length of the bytes in the string are longer than `(Buffer.poolSize >>> 1)`. I was a little bit confused by the `(Buffer.poolSize >>> 1)` bit so I did some digging up on it. The value of `Buffer.poolSize` is `8 * 1024` or `8192` bytes. This number represents the number of bytes that the internal Buffer object utilizes. This value is then shifted 1 bit to the right using a zero-fill right shift. A zero-fill right shift differs from the “standard” right shift (`>>`) because it does not add in bits from the left as the bits are shifted rightward. As a result, every number that undergoes a zero-filling rightward shift is always a positive number. In essence, the if-statement determines if the string that the user is attempting to create a Buffer from will fit in the 8192 bytes that are pre-allocated in the Buffer by default. If so, it’ll load the string in accordingly.

    return createFromString(string, encoding);

On the other hand, if the number of bytes in the string is greater than the number of bytes that are pre-allocated in a Buffer, it’ll go ahead and allocate more space for the string before storing it into the Buffer.

    if (length > (poolSize - poolOffset))
      createPool();
    var b = new FastBuffer(allocPool, poolOffset, length);
    const actual = b.write(string, encoding);
    if (actual !== length) {
      // byteLength() may overestimate. That's a rare case, though.
      b = new FastBuffer(allocPool, poolOffset, actual);
    }
    poolOffset += actual;
    alignPool();
    return b;

Next, I dived into the `fromArrayBuffer` function which is executed when the user passes an array buffer to `Buffer.from`. The function definition for the `fromArrayBuffer` function takes the array object, the byte offset, and the length of the array buffer.

    function fromArrayBuffer(obj, byteOffset, length) {

The function starts by responding to potentially messy parameters passed to the function. It first checks to see if the user didn’t pass a `byteOffset` to the function, in which case it uses an offset of 0. In other cases, the function ensures that the `byteOffset` is a positive number.

    if (byteOffset === undefined) {
      byteOffset = 0;
    } else {
      byteOffset = +byteOffset;
      // check for NaN
      if (byteOffset !== byteOffset)
        byteOffset = 0;
    }

The length of the buffer is defined as the length of the input buffer array minus the offset.

    const maxLength = obj.byteLength - byteOffset;

If the `byteOffset` was larger than the length of the input buffer, then the function throws an error.

    if (maxLength < 0)
        throw new errors.RangeError('ERR_BUFFER_OUT_OF_BOUNDS', 'offset');

Finally, the function executes some checks to ensure that the length of the new ArrayBuffer is a positive number within the bounds of the newly offset object.

    if (length === undefined) {
      length = maxLength;
    } else {
      // convert length to non-negative integer
      length = +length;
      // Check for NaN
      if (length !== length) {
        length = 0;
      } else if (length > 0) {
        if (length > maxLength)
          throw new errors.RangeError('ERR_BUFFER_OUT_OF_BOUNDS', 'length');
      } else {
        length = 0;
      }

Then the new Buffer is created using the modified `byteOffset` and `length` parameters from the old `obj` ArrayBuffer.

    return new FastBuffer(obj, byteOffset, length);

Going back to the `Buffer.from` function, it does a few more validation checks to ensure that the `value` the user is attempting to create a Buffer from is valid.

    if (value === null || value === undefined) {
      throw new errors.TypeError(
        'ERR_INVALID_ARG_TYPE',
        'first argument',
        ['string', 'Buffer', 'ArrayBuffer', 'Array', 'Array-like Object'],
        value
      );
    }
    
    if (typeof value === 'number')
      throw new errors.TypeError(
        'ERR_INVALID_ARG_TYPE', 'value', 'not number', value
      );

Then the function checks to see if the `value` passed by the user contains a `valueOf` function. The `valueOf` function is defined on the Object prototype in JavaScript and returns a value of a primitive type for a specific object in JavaScript. For example, a developer might create a special `Cost` object that stores the price of an object and create a `valueOf` function that returns the price as a Number (which is floating point). In a sense, this bit of the `Buffer.from` method attempts to extract a primitive type out of any object passed as a `value` to the function and uses it to generate a new Buffer.

    const valueOf = value.valueOf && value.valueOf();
    if (valueOf !== null && valueOf !== undefined && valueOf !== value)
      return Buffer.from(valueOf, encodingOrOffset, length);

Then the function attempts to invoke the `fromObject` function and returns the buffer created by this function (assuming it is non-null).

    var b = fromObject(value);
    if (b)
      return b;

The next check evaluates if the value passed has a `toPrimitive` function defined. The `toPrimitive` function returns a primitive value from a given JavaScript object. The `Buffer.from` function attempts to create a Buffer from the primitive returned by this function if it is available.

    if (typeof value[Symbol.toPrimitive] === 'function') {
      return Buffer.from(value[Symbol.toPrimitive]('string'),
                         encodingOrOffset,
                         length);
    }

In all other cases, the function raises a TypeError.

    throw new errors.TypeError(
      'ERR_INVALID_ARG_TYPE',
      'first argument',
      ['string', 'Buffer', 'ArrayBuffer', 'Array', 'Array-like Object'],
      value
    );

So in essence, the `Buffer.from` function will attempt to process values that are strings or ArrayBuffers then attempt to process values that are Array-like then attempt to extract a primitive value to create a Buffer from then emit a TypeError to the user in all other cases.

The next function on the `Buffer` object that I wanted to read through was the `write` function. The function definition for the `Buffer.write` function requires that the developer pass the `string` to write, the number of bytes to skip before writing the string as given by the `offset`, the number of bytes to write as given by `length`, and the `encoding` of the `string`.

    Buffer.prototype.write = function write(string, offset, length, encoding) {

If no offset is given, the function writes the string at the start of the Buffer.

    if (offset === undefined) {
      return this.utf8Write(string, 0, this.length);
    }

If no `offset` or `length` is given, the function starts at an `offset` of 0 and uses the default length of the Buffer.

    // Buffer#write(string, encoding)
    } else if (length === undefined && typeof offset === 'string') {
      encoding = offset;
      length = this.length;
      offset = 0;
    }

Finally, if the developer provides both an `offset` and a `length`, the function ensures that they are valid finite values and calculates the `length` properly if an `offset` was given.

    } else if (isFinite(offset)) {
      offset = offset >>> 0;
      if (isFinite(length)) {
        length = length >>> 0;
      } else {
        encoding = length;
        length = undefined;
      }
    
      var remaining = this.length - offset;
      if (length === undefined || length > remaining)
        length = remaining;
    
      if (string.length > 0 && (length < 0 || offset < 0))
        throw new errors.RangeError('ERR_BUFFER_OUT_OF_BOUNDS', 'length', true);
    }

In all other cases, the function assumes that the developer is attempting to use an outdated version of the `Buffer.write` API and raises an error.

     else {
       // if someone is still calling the obsolete form of write(), tell them.
       // we don't want eg buf.write("foo", "utf8", 10) to silently turn into
       // buf.write("foo", "utf8"), so we can't ignore extra args
       throw new errors.Error(
         'ERR_NO_LONGER_SUPPORTED',
         'Buffer.write(string, encoding, offset[, length])'
       );
     }

Once the function has set the `offset` and `length` variables appropriately, it determines what to do depending on the different possible `encodings`. If no `encoding` is given, the `Buffer.write` method assumes UTF-8 by default.

    if (!encoding) return this.utf8Write(string, offset, length);

In other cases, the function invokes the appropriate `xWrite` function where `x` is an encoding. I found it interesting that the switch statement used to evaluate the potential encodings checked the length of the `encoding` string then checked the actual value of `encoding`. In essence, the function evaluates the situation where the encoding is `utf8` and `utf-8` in different branches of the switch statement.

      switch (encoding.length) {
        case 4: ...
        case 5: ...
        case 7: ...
        case 8: ...
        case 6: ...
        case 3: ...
      }

There’s a few more interesting functions that I was hoping to read through in the Buffer class but I might end up putting those in a part 2 of this blog post. For now, I’ll stop here. If you have any questions or comments about the above, feel free to [ask me a question](https://blog.safia.rocks/ask) or [reach out to me on Twitter](https://twitter.com/captainsafia).

