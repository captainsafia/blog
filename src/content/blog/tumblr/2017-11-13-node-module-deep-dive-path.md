---
layout: post
title: 'Node module deep-dive: path'
date: '2017-11-13T10:00:59-08:00'
tags:
- node-module-deep-dive
tumblr_url: https://blog.safia.rocks/post/167452569077/node-module-deep-dive-path
---
Another Monday, another Node module walkthrough! For the second installment of this multi-part series, I decided to take a look into the `path` module in Node. The `path` module gives the developer the ability to work with file and directory paths. You might’ve used it to do things like determine the base of a path or to join multiple paths together. This code snippet below shows a sample of how the `path` module works.

    > const path = require('path');
    > path.basename('~/this/is/a/test/file.html');
    'file.html'
    > path.dirname('~/this/is/a/test/file.html');
    '~/this/is/a/test'
    > path.extname('~/this/is/a/test/file.html');
    '.html'
    > path.join('~', 'this', 'is', 'a', 'test');
    '~/this/is/a/test'

If you’re interested in exploring the full-scope of the `path` module API, you can check out the [documentation for the module](https://nodejs.org/api/path.html).

Alright! Now it’s time to dive into the code itself. Like last time, [here](https://github.com/nodejs/node/blob/ff21851816f8512a1488265a878140d8aa67683a/lib/path.js) is a link pinned to the version of the code that I will be walking through in this post. I’ll include embedded code snippets but also reference relevant parts of the code base with links to specific lines.

Before I started diving into the code itself, I scrolled through it quickly to get a sense of the common patterns of the code. For the most part, a lot of the functions defined in this module iteratively compute different string manipulations. There are _a lot_ of for-loops and conditionals. Another thing to note is the way that the API functions are exposed from the ‘path’ module. The 'path’ module defines two Objects `win32` and `posix` that store the function definitions for each platform. In the final export, the module assesses what platform the module is being invoked from and exports the functions that match with that platform. For my code read, I focused specifically on the functions defined for `posix` platforms, since that’s platform I develop and deploy to most often.

    if (process.platform === 'win32')
      module.exports = win32;
    else
      module.exports = posix;

Since the `path` module API exposes quite a few functions, I’ll focus on some of the most popular in my read. The first function that I looked into is the `join` function. You’ve probably seen this used a ton in the configuration of Express servers and in Electron-based desktop applications.

    join: function join() {
        if (arguments.length === 0)
          return '.';

The first thing that I found interesting about this bit of code is that it uses the `arguments` object in JavaScript. The `argument` object is a list-based data structure that corresponds to the arguments based to the function. The `join` method takes a list of paths to join as its input. Instead of defining a special parameter to use for the function, `join` relies on the `arguments` object which gives users the ability to provide an arbitrary number of arguments to the function.

        var joined;
        for (var i = 0; i 0) {
            if (joined === undefined)
              joined = arg;
            else
              joined += '/' + arg;
          }
        }

The function iterates through each of the arguments, checks to see if it is a valid path, and joins it to a concatenated string called `joined`. The `assertPath` function is a simple function that checks to see if the parameter that is passed to the `assertPath` function is a string.

    function assertPath(path) {
      if (typeof path !== 'string') {
        throw new errors.TypeError('ERR_INVALID_ARG_TYPE', 'path', 'string');
      }
    }

Finally, the function normalizes the concatenated path and returns it.

        if (joined === undefined)
          return '.';
        return posix.normalize(joined);

In my opinion, that was a pretty straightforward function and an excellent example of the kind of code that definitely belongs in a standard library.

The last functions that I wanted to look into were the `dirname` and `basename` functions.

    dirname: function dirname(path) {
      assertPath(path);
      if (path.length === 0)
        return '.';

The function starts off by evaluating the validity of the `path` that was passed in as a parameter.

        var code = path.charCodeAt(0);
        var hasRoot = (code === 47/*/*/);

The function checks to see if the first character in the provided path is a `/` which indicates that the path provided is an absolute path that starts at the root directory of the file system (since we are on a POSIX system). This check is used later to preserve the presence of the root `/` in the final string.

        if (end === -1)
          return hasRoot ? '/' : '.';
        if (hasRoot && end === 1)
          return '//';

The main body of a function is a for-loop that iterates backwards through the provided `path` looking for a `/` character. If it finds it, it breaks out of the for loop and stores its index in a variable called `end`. Later, it uses `end` to get the appropriate substring in the provided path.

        return path.slice(0, end);

So essentially, the logic of the `dirname` function is as follows: walk backwards through the `path` from the end to the start until you hit a `/` character. If so, that means you’ve iterated through all the characters in the filename and the remaining characters correspond to the directory name.

The `basename` function is a little more involved. It takes two parameters: `path`, the path to find the basename in and optionally `ext`, the extension to truncate from the basename. As per usual, it starts by evaluating the validity of the parameters that were passed in.

    basename: function basename(path, ext) {
        if (ext !== undefined && typeof ext !== 'string')
          throw new errors.TypeError('ERR_INVALID_ARG_TYPE', 'ext', 'string');
        assertPath(path);

The logic associated with how it iterates if the user provides an `ext` parameter is a little complicated, so I started by looking at the logic for situations where `basename` is called without an `ext` parameter.

          for (i = path.length - 1; i >= 0; --i) {
            if (path.charCodeAt(i) === 47/*/*/) {
              // If we reached a path separator that was not part of a set of path
              // separators at the end of the string, stop now
              if (!matchedSlash) {
                start = i + 1;
                break;
              }
            } else if (end === -1) {
              // We saw the first non-path separator, mark this as the end of our
              // path component
              matchedSlash = false;
              end = i + 1;
            }
          }
    
          if (end === -1)
            return '';
          return path.slice(start, end);

The function iterates backward through the string (similar to the `dirname` function) until it finds the first instance of the `/` character. This time, it uses the index of that character as the _start_ of the slice on the path.

The logic for the case where the user does provide an `ext` parameter is more complicated because it has to keep track of the extension in the string.

    for (i = path.length - 1; i >= 0; --i) {
            const code = path.charCodeAt(i);
            if (code === 47/*/*/) {
              // If we reached a path separator that was not part of a set of path
              // separators at the end of the string, stop now
              if (!matchedSlash) {
                start = i + 1;
                break;
              }
            } else {

It iterates backwards through the string to find the first `/` character and stores it as the `start` point for the slice and breaks out of the loop. If it doesn’t find a `/` character at the position it is in, it alternately computes some logic to determine where the extension ends and stores that as the end of the string.

            if (firstNonSlashEnd === -1) {
                // We saw the first non-path separator, remember this index in case
                // we need it if the extension ends up not matching
                matchedSlash = false;
                firstNonSlashEnd = i + 1;
              }
              if (extIdx >= 0) {
                // Try to match the explicit extension
                if (code === ext.charCodeAt(extIdx)) {
                  if (--extIdx === -1) {
                    // We matched the extension, so mark this as the end of our path
                    // component
                    end = i;
                  }
                } else {
                  // Extension does not match, so our result is the entire path
                  // component
                  extIdx = -1;
                  end = firstNonSlashEnd;
                }

And that’s that! Most of the functions that are exposed by the `path` module are simple string manipulation (and a lot of edge-case handling). From a quick-read through the code, there was definitely a lot more complexity in the functions that pertained to `win32`-based files ystems, especially around handling drives (`C:` and `D:`) and escaping things (fun!).

If you have any comments or questions, feel free to [ask me a question](https://blog.safia.rocks/ask) or reach out to me [on Twitter](https://twitter.com/captainsafia).

