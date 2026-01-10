---
layout: post
title: 'Node module deep-dive: querystring'
date: '2017-11-06T10:00:56-08:00'
tags:
- node-module-deep-dive
tumblr_url: https://blog.safia.rocks/post/167198565657/node-module-deep-dive-querystring
---
So, I figured I would start a new series here on the good ol’ blog. For a while, I’ve wanted to do code walkthroughs of standard libraries and popular packages in the Node ecosystem. I figured it’s about time that I change that intention to action and actually write up one. So here it goes, my first ever annotated code walkthrough.

I wanna start off by looking at one of the most fundamental modules in the Node standard library: `querystring`. `querystring` is a module that allows users to extract values of the query portion of a URL and build a query from an object of key value associations. Here’s a quick code snippet that shows the four different API functions, `string`, `parse`, `stringify`, and `unescape`, that the `querystring` module exposes.

    > const querystring = require("querystring");
    > querystring.escape("key=It's the final countdown");
    'key%3DIt\'s%20the%20final%20countdown'
    > querystring.parse("foo=bar&abc=xyz&abc=123");
    { foo: 'bar', abc: ['xyz', '123'] }
    > querystring.stringify({ foo: 'bar', baz: ['qux', 'quux'], corge: 'i' });
    'foo=bar&baz=qux&baz=quux&corge=i'
    > querystring.unescape("key%3DIt\'s%20the%20final%20countdown");
    'key=It\'s the final countdown'

Alright! Let’s dive into the fun part. I’ll be examining the code for querystring as it stands as of my writing this post. You can find a copy of this version [here](https://github.com/nodejs/node/blob/291ff72f859df3c4c3849021419f37cd542840a6/lib/querystring.js).

The first thing that caught my eye was this chunk of code on lines 47-64.

    const unhexTable = [
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, // 0 - 15
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, // 16 - 31
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, // 32 - 47
      +0, +1, +2, +3, +4, +5, +6, +7, +8, +9, -1, -1, -1, -1, -1, -1, // 48 - 63
      -1, 10, 11, 12, 13, 14, 15, -1, -1, -1, -1, -1, -1, -1, -1, -1, // 64 - 79
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, // 80 - 95
      -1, 10, 11, 12, 13, 14, 15, -1, -1, -1, -1, -1, -1, -1, -1, -1, // 96 - 111
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, // 112 - 127
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, // 128 ...
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 // ... 255
    ];

What the heckin’ heck is this nonsense? I did a search for the term `unhexTable` throughout the codebase to find out where it was used. In addition to the definition, the search returned two other results. They occurred on lines 86 and 91 of the codebase Here’s the code block that encompasses these references.

        if (currentChar === 37 /*'%'*/ && index < maxLength) {
          currentChar = s.charCodeAt(++index);
          hexHigh = unhexTable[currentChar];
          if (!(hexHigh >= 0)) {
            out[outIndex++] = 37; // '%'
          } else {
            nextChar = s.charCodeAt(++index);
            hexLow = unhexTable[nextChar];
            if (!(hexLow >= 0)) {
              out[outIndex++] = 37; // '%'
              out[outIndex++] = currentChar;
              currentChar = nextChar;
            } else {
              hasHex = true;
              currentChar = hexHigh * 16 + hexLow;
            }
          }
        }

All of this is happening within the `unescapeBuffer` function. After a quick search, I discovered that the `unescapeBuffer` function is invoked by the `unescape` function that is exposed from our module (see line 113). So this is where all the interesting action for unescaping our query string happens!

Alright! So what’s all this business with the `unhexTable`? I started to read through the `unescapeBuffer` function to figure out exactly what it was doing. I started with line 67.

    var out = Buffer.allocUnsafe(s.length);

So the function starts by initializing a Buffer of the length of the string that is passed to the function.

(At this point, I could dive into what `allocUnsafe` in the `Buffer` class is doing, but I am going to reserve that for another blog post.)

After that, there are a couple of statements that initialize different variables that will be used later on in the function.

      var index = 0;
      var outIndex = 0;
      var currentChar;
      var nextChar;
      var hexHigh;
      var hexLow;
      var maxLength = s.length - 2;
      // Flag to know if some hex chars have been decoded
      var hasHex = false;

The next chunk of code is a while loop that iterates through each character in the string. If the character is a `+` and the function is set to change `+` to spaces, it sets the value of that character in the escaped string to a space.

      while (index < s.length) {
        currentChar = s.charCodeAt(index);
        if (currentChar === 43 /*'+'*/ && decodeSpaces) {
          out[outIndex++] = 32; // ' '
          index++;
          continue;
        }

The second set of if statements checks to see if iterator is at a character sequence that begins with a `%`, which signifies the upcoming characters will represent a hex code. The program then fetches the character code of the following character. The program then uses that character code as the index to look for in the `hexTable` list. If the value returned from this lookup is `-1`, the function sets the value of the character in the output string to a percent sign. If the value returns from the lookup in the `hexTable` is greater than `-1`, the function parses the seceding characters as hex character codes.

        if (currentChar === 37 /*'%'*/ && index < maxLength) {
          currentChar = s.charCodeAt(++index);
          hexHigh = unhexTable[currentChar];
          if (!(hexHigh >= 0)) {
            out[outIndex++] = 37; // '%'
          } else {
            nextChar = s.charCodeAt(++index);
            hexLow = unhexTable[nextChar];
            if (!(hexLow >= 0)) {
              out[outIndex++] = 37; // '%'
              out[outIndex++] = currentChar;
              currentChar = nextChar;
            } else {
              hasHex = true;
              currentChar = hexHigh * 16 + hexLow;
            }
          }
        }
        out[outIndex++] = currentChar;
        index++;
      }

Let’s dive into this portion of the code a bit more. So, if the first character is a valid hex code, it uses the character code of the next character as the lookup index for `unhexTable`. This value is stared in the `hexLow` variable. If that variable is equal to `-1`, the value is not parsed as a hex character sequence. If it is not equal to`-1`, the character is parsed as a hex character code. The function takes the value of the hex code in the highest (second) place (`hexHigh`) and multiplies it by 16 and adds it to the value of the hex code in the first place.

          } else {
            nextChar = s.charCodeAt(++index);
            hexLow = unhexTable[nextChar];
            if (!(hexLow >= 0)) {
              out[outIndex++] = 37; // '%'
              out[outIndex++] = currentChar;
              currentChar = nextChar;
            } else {
              hasHex = true;
              currentChar = hexHigh * 16 + hexLow;
            }
          }

The last line of the function confused me for a while.

    return hasHex ? out.slice(0, outIndex) : out;

If we detected a hex sequence in the query then slice the output string from `0` to the `outIndex`, otherwise leave it as is. This confused me because I assumed that the value of `outIndex` would be equal to the length of the output string at the end of the program. I could’ve taken the time to figure out if that assumption was true myself but, to be honest, it was almost midnight and I don’t have room in my life for that kind of nonsense that late at night. So I ran `git blame` on the codebase and tried to find out what commit was associated with that particular change. It turns out this wasn’t that much helpful. I was expecting there to be an isolated commit that described why that particular line was that way but the most recent changes to it were part of a larger refactor of the `escape` function. The more I look at it, the more certain I am that there is no need for the ternary operator here, but I’ve yet to find some reproducible evidence for this.

The next function that I looked into was the `parse` function. The first portion of our function does some basic setup. The function parses out 1000 key-value pairs in the querystring by default, but the user can pass a `maxKeys` value in the `options` object to change this. The function also uses the `unescape` function we looked into above unless the user provides something different in the options object.

    function parse(qs, sep, eq, options) {
      const obj = Object.create(null);
    
      if (typeof qs !== 'string' || qs.length === 0) {
        return obj;
      }
    
      var sepCodes = (!sep ? defSepCodes : charCodes(sep + ''));
      var eqCodes = (!eq ? defEqCodes : charCodes(eq + ''));
      const sepLen = sepCodes.length;
      const eqLen = eqCodes.length;
    
      var pairs = 1000;
      if (options && typeof options.maxKeys === 'number') {
        // -1 is used in place of a value like Infinity for meaning
        // "unlimited pairs" because of additional checks V8 (at least as of v5.4)
        // has to do when using variables that contain values like Infinity. Since
        // `pairs` is always decremented and checked explicitly for 0, -1 works
        // effectively the same as Infinity, while providing a significant
        // performance boost.
        pairs = (options.maxKeys > 0 ? options.maxKeys : -1);
      }
    
      var decode = QueryString.unescape;
      if (options && typeof options.decodeURIComponent === 'function') {
        decode = options.decodeURIComponent;
      }
      const customDecode = (decode !== qsUnescape);

The function then iterates through each character in the querystring and fetches the character code for that character.

      var lastPos = 0;
      var sepIdx = 0;
      var eqIdx = 0;
      var key = '';
      var value = '';
      var keyEncoded = customDecode;
      var valEncoded = customDecode;
      const plusChar = (customDecode ? '%20' : ' ');
      var encodeCheck = 0;
      for (var i = 0; i < qs.length; ++i) {
        const code = qs.charCodeAt(i);

The function then checks to see if the examined character corresponds to a key-value separator (like the ’&’ character in a querystring) and executes some special logic. It checks to see if there is a ‘key=value’ segment following the ’&’ and attempts to extract the appropriate key and value pairs from it (line 304 - 347).

If the character code doesn’t correspond to a separator, the function checks to see if it corresponds to an ’=’ sign or another key-value seperator that it uses to extract the key from the string sequence.

Next, the function checks to see if character being examined is a ’+’ sign. If that is the case, then the function builds a space-seperated string. If the character is a ’%’, the function decodes the hex characters that follow it appropriately.

          if (code === 43/*+*/) {
            if (lastPos < i)
              value += qs.slice(lastPos, i);
            value += plusChar;
            lastPos = i + 1;
          } else if (!valEncoded) {
            // Try to match an (valid) encoded byte (once) to minimize unnecessary
            // calls to string decoding functions
            if (code === 37/*%*/) {
              encodeCheck = 1;
            } else if (encodeCheck > 0) {
              // eslint-disable-next-line no-extra-boolean-cast
              if (!!isHexTable[code]) {
                if (++encodeCheck === 3)
                  valEncoded = true;
              } else {
                encodeCheck = 0;
              }
            }
          }

There’s a few remaining checks that need to be done on any unprocessed data. Namely, the function checks to see if there is one remaining key-value pair that needs to be added or if the function can return on empty data. I assume this is included here to handle edge cases that might occur when parsing.

      // Deal with any leftover key or value data
      if (lastPos < qs.length) {
        if (eqIdx < eqLen)
          key += qs.slice(lastPos);
        else if (sepIdx < sepLen)
          value += qs.slice(lastPos);
      } else if (eqIdx === 0 && key.length === 0) {
        // We ended on an empty substring
        return obj;
      }

The last set of checks checks to see if the keys or values need to be decoded (using the `unescape` function) or if the value at a particular key needs to be constructed as an array.

      if (key.length > 0 && keyEncoded)
        key = decodeStr(key, decode);
      if (value.length > 0 && valEncoded)
        value = decodeStr(value, decode);
      if (obj[key] === undefined) {
        obj[key] = value;
      } else {
        const curValue = obj[key];
        // A simple Array-specific property check is enough here to
        // distinguish from a string value and is faster and still safe since
        // we are generating all of the values being assigned.
        if (curValue.pop)
          curValue[curValue.length] = value;
        else
          obj[key] = [curValue, value];
      }

And that’s it for the `parse` function!

Alright! I went on to take a look at another function exposed by the `querystring` module, `stringify`. The `stringify` function starts by initializing some required variables. It utilizes the `escape` function to encode values unless the user provides an encode function in the options.

    function stringify(obj, sep, eq, options) {
      sep = sep || '&';
      eq = eq || '=';
    
      var encode = QueryString.escape;
      if (options && typeof options.encodeURIComponent === 'function') {
        encode = options.encodeURIComponent;
      }

After that, the function iterates through each key-value pair in the object. As it iterates through each pair, it encodes and stringifies the keys.

    if (obj !== null && typeof obj === 'object') {
        var keys = Object.keys(obj);
        var len = keys.length;
        var flast = len - 1;
        var fields = '';
        for (var i = 0; i < len; ++i) {
          var k = keys[i];
          var v = obj[k];
          var ks = encode(stringifyPrimitive(k)) + eq;

Next, it checks to see whether the value in the key-value pair is an array. If it is, it iterates through each element in the array and adds a `ks=element` relation to the string. If it is not, the function builds a `ks=v` association from the key-value pair.

          if (Array.isArray(v)) {
            var vlen = v.length;
            var vlast = vlen - 1;
            for (var j = 0; j < vlen; ++j) {
              fields += ks + encode(stringifyPrimitive(v[j]));
              if (j < vlast)
                fields += sep;
            }
            if (vlen && i < flast)
              fields += sep;
          } else {
            fields += ks + encode(stringifyPrimitive(v));
            if (i < flast)
              fields += sep;
          }

This function was pretty straightforward for me to read. On to the last function exposed by the API, `escape`. The function iterates through each character in the string and fetches the character code that corresponds with that character.

    function qsEscape(str) {
      if (typeof str !== 'string') {
        if (typeof str === 'object')
          str = String(str);
        else
          str += '';
      }
      var out = '';
      var lastPos = 0;
    
      for (var i = 0; i < str.length; ++i) {
        var c = str.charCodeAt(i);

If the character code is less the `0x80`, meaning the character represented is a valid ASCII character (the hex codes for ASCII characters range from `0` to `0x7F`). The function then checks to see if the character should be escaped by doing a lookup in a `noEscape` table. The table allows characters that are punctuation, digits, or characters to not be escaped and requires that everything else be escaped. It then checks to see if the position of the character being examined is greater that the `lastPos` found (meaning the cursor has run past the length of string) and slices the string appropriately. Finally, if the character does need to be escaped, it looks up the character code in the `hexTable` and appends it to the output string.

        if (c < 0x80) {
          if (noEscape[c] === 1)
            continue;
          if (lastPos < i)
            out += str.slice(lastPos, i);
          lastPos = i + 1;
          out += hexTable[c];
          continue;
        }

The next if-statement checks to see if the character is a multi-byte character code. Multi-byte characters usually represent characters for accented and non-English letters.

        if (c < 0x800) {
          lastPos = i + 1;
          out += hexTable[0xC0 | (c >> 6)] + hexTable[0x80 | (c & 0x3F)];
          continue;
        }

When this is the case, the output string is calculated using the following lookup in the `hexTable`.

    out += hexTable[0xC0 | (c >> 6)] + hexTable[0x80 | (c & 0x3F)];

Alright! There’s a lot going on here, so I started working through it. The `hexTable` is defined in the `internal/querystring` support module and is generated like this.

    const hexTable = new Array(256);
    for (var i = 0; i < 256; ++i)
      hexTable[i] = '%' + ((i < 16 ? '0' : '') + i.toString(16)).toUpperCase();

So the output is an array of stirngs that represents the hex character codes for 256 characters. It looks a little something like this `['%00', '%01', '%02',..., '%FD', '%FE', '%FF']`. So, the lookup statement above.

    out += hexTable[0xC0 | (c >> 6)] + hexTable[0x80 | (c & 0x3F)];

The statement `c >> 6` shifts the character code six bits to the right and executes a bitwise OR the binary representation of 192. It the concentates the result of that lookup with the bitwise OR of 128 in binary and the bitwise AND of the character code and 63 in binary. So I know that multibyte sequences begin at `0x80` but I couldn’t figure out exactly what was going on here.

The next case that is examined is this.

        if (c < 0xD800 || c >= 0xE000) {
          lastPos = i + 1;
          out += hexTable[0xE0 | (c >> 12)] +
                 hexTable[0x80 | ((c >> 6) & 0x3F)] +
                 hexTable[0x80 | (c & 0x3F)];
          continue;
        }

Yikes.

In all other cases, the function uses the following strategy to generate the output string.

        var c2 = str.charCodeAt(i) & 0x3FF;
        lastPos = i + 1;
        c = 0x10000 + (((c & 0x3FF) << 10) | c2);
        out += hexTable[0xF0 | (c >> 18)] +
               hexTable[0x80 | ((c >> 12) & 0x3F)] +
               hexTable[0x80 | ((c >> 6) & 0x3F)] +
               hexTable[0x80 | (c & 0x3F)];

I was genuinely confused by all of this. When I went to do some investigating on this, I discovered that all this hex-related code came from [this singular commit](https://github.com/nodejs/node/pull/847). It appears to be part of a performance-related factor. There isn’t a ton of information around _why_ this particular methodology was used and I suspect this logic was copied from another encode function somewhere. I’ll have to dig into this further at some point.

In the end, there is some logic that handles how the output string is returned. If the value of `lastPos` is 0, meaning that no characters were processed, the original string is returned. Otherwise, the generated output string is returned.

      if (lastPos === 0)
        return str;
      if (lastPos < str.length)
        return out + str.slice(lastPos);
      return out;

And that’s that! I covered the four functions exposed by the Node `querystring` module.

If you pick up on anything I missed on this annotated walkthrough, let me know [on Twitter](https://twitter.com/captainsafia).

