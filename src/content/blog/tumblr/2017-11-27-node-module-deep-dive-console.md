---
layout: post
title: 'Node module deep-dive: console'
date: '2017-11-27T10:00:41-08:00'
tags:
- node-module-deep-dive
tumblr_url: https://blog.safia.rocks/post/167943601717/node-module-deep-dive-console
---
Howdy there! Yep, it’s another Monday. That means it’s time for me to head over to the good ol’ GitHub dot com for another Node module deep-dive. If you’re new around here, I’ve been going through and reading the Node code base over the past few weeks. My goal is to learn more about what goes on under the hood in the Node standard library and to learn some new code patterns. This week, I’m diving into the `console` module. At this point, we need to take a break and give some well-deserved thanks to `console`, the most reliable debugging tool that ever lived! For the unfamiliar, `console` exposes a set of methods for printing to standard output and standard error. It’s commonly used like this.

    > console.log("Just a standard message going to standard out.");
    Just a standard message going to standard out.
    undefined
    > console.error("Error: Something terrible has happened and this is going to stderr.");
    Error: Something terrible has happened and this is going to stderr.
    undefined
    > console.info("This is also informative and is going to standard out.");
    This is also informative and is going to standard out.
    undefined

Pretty nifty, huh? Alright! Let’s dive into the code. As per usual, [here](https://github.com/nodejs/node/blob/9de15de05a47d645583699a5135bfb4b8ea1c5c2/lib/console.js) is a permalink to the version of the `console` module that I’ll be reading through in this post. I’ve done a few of these code reads at this point and I’ve learned a bit of something: it helps to read these Node modules starting from the bottom. Essentially, this gives me a chance to figure out what the API exposed by the module is and read through the relevant modules much more effectively. In the case of the `console` module, the exports look like this.

    module.exports = new Console(process.stdout, process.stderr);
    module.exports.Console = Console;

The default export of the `console` module is an instance of the `Console` object, but the module also exports the definition for the object itself so that users can instantiate their own instances in their code. The `Console` object defines several functions on its prototype. I was already aware of some functions, like `log` and `debug`, but there were a few that were new to me, like `time` and `count`. The key supporting function behind the functions exposed by the API is the `write` function, which has the following function definition.

    function write(ignoreErrors, stream, string, errorhandler, groupIndent) {

I read through the body of the function and figured out what each of the parameters was responsible for.

- `ignoreErrors`: This parameter is a Boolean that defines whether to ignore errors that occur when writing to an output stream. Note that by default, this is set to `true`.
- `stream`: This parameter defines the stream object that the function should write information to.
- `string`: This parameter defines the string that should be hidden.
- `errorhandler`: A callback that is executed whenever an error is encountered when writing to the stream.
- `groupIndent`: This parameter defines how many indents to put in each new line. For example, this is particularly useful when printing a stack trace since the trace is usually indented.

I found it particularly useful to establish what each of the parameters did because it made reading through the body of the function much easier. The first couple of lines check to see if the `string` needs to be indented after every newline and checks to see if there are any newlines in the `string`. If there is a `groupIndent` defined and newlines in the `string`, the newline is replaced with the appropriate indent.

    if (groupIndent.length !== 0) {
      if (string.indexOf('\n') !== -1) {
        string = string.replace(/\n/g, `\n${groupIndent}`);
      }
      string = groupIndent + string;
    }
    string += '\n';

The next portion of the code base handles the `ignoreErrors` parameter described above. If `ignoreErrors` is true, the string is directly sent to the stream without any error handling.

    if (!ignoreErrors) return stream.write(string);

On the other hand, if we _do_ want to handle errors the function executes a try-catch clause.

    try {
      // Add and later remove a noop error handler to catch synchronous errors.
      stream.once('error', noop);
    
      stream.write(string, errorhandler);
    } catch (e) {
      // console is a debugging utility, so it swallowing errors is not desirable
      // even in edge cases such as low stack space.
      if (e.message === 'Maximum call stack size exceeded')
        throw e;
      // Sorry, there’s no proper way to pass along the error here.
    } finally {
      stream.removeListener('error', noop);
    }

I found the `stream.once('error', noop);` statement rather interesting and decided to do some digging to figure out what it was all about. I eventually found [this pull request](https://github.com/nodejs/node/pull/9744) and the [corresponding issue](https://github.com/nodejs/node/issues/831). It appears that this statement is added to handle cases where standard out and standard error are unavailable. Instead of throwing an error, the function should fail silently. However, if an error occurs once the stream has been initiated for writing, the function should handle the errors using the `errorhandler`.

Most of the functions exposed by the console API utilize the `write` function. For example, the oft-used `log` function looks like this.

    Console.prototype.log = function log(...args) {
      write(this._ignoreErrors,
            this._stdout,
            util.format.apply(null, args),
            this._stdoutErrorHandler,
            this[kGroupIndent]);
    };

And the `warn` function looks a little like this.

    Console.prototype.warn = function warn(...args) {
      write(this._ignoreErrors,
            this._stderr,
            util.format.apply(null, args),
            this._stderrErrorHandler,
            this[kGroupIndent]);
    };

There were a few functions that were new to me in the console API. For example, the `time` and `timeEnd` functions are used to measure the elapsed time between two points in the code base. For example, we can test how much time elapses between the execution of two statements as follows.

    > console.time("testing-time");
    undefined
    > for (var i = 0; i console.timeEnd("testing-time");
    testing-time: 42570.609ms

The `time` function adds a key-value pair to a `_times` property on the `Console` object which defines a relationship between the label and the current timestamp as retrieved by the `process.hrtime` function.

    Console.prototype.time = function time(label = 'default') {
      // Coerces everything other than Symbol to a string
      label = `${label}`;
      this._times.set(label, process.hrtime());
    };

The `timeEnd` retrieves the start timestamp stored by the `time` function and calculates the amount of time that has elapsed since that time.

    Console.prototype.timeEnd = function timeEnd(label = 'default') {
      // Coerces everything other than Symbol to a string
      label = `${label}`;
      const time = this._times.get(label);
      if (!time) {
        process.emitWarning(`No such label '${label}' for console.timeEnd()`);
        return;
      }
      const duration = process.hrtime(time);
      const ms = duration[0] * 1000 + duration[1] / 1e6;
      this.log('%s: %sms', label, ms.toFixed(3));
      this._times.delete(label);
    };

In combination, the `time` and `timeEnd` function serve as nice functions to benchmarking portions of a code base.

Another set of functions that caught my eye while reading through the code base were the `count` and `countReset` functions. These functions are used to maintain a `count` given a particular `label`.

    > console.count("red-fish");
    red-fish: 1
    undefined
    > console.count("blue-fish");
    blue-fish: 1
    undefined
    > console.count("red-fish");
    red-fish: 2
    undefined
    > console.count("blue-fish");
    blue-fish: 2
    undefined
    > console.count("red-fish");
    red-fish: 3
    undefined

The `count` function increments or resets a counter defined for a specific `label` that is stored in the `kCounts` property on the Console object.

    Console.prototype.count = function count(label = 'default') {
      // Ensures that label is a string, and only things that can be
      // coerced to strings. e.g. Symbol is not allowed
      label = `${label}`;
      const counts = this[kCounts];
      let count = counts.get(label);
      if (count === undefined)
        count = 1;
      else
        count++;
      counts.set(label, count);
      this.log(`${label}: ${count}`);
    };

And the `resetCount` function resets the count for a particular label.

    Console.prototype.countReset = function countReset(label = 'default') {
      const counts = this[kCounts];
      counts.delete(`${label}`);
    };

There is an interesting note written above the `countReset` function which states.

    // Not yet defined by the https://console.spec.whatwg.org, but
    // proposed to be added and currently implemented by Edge. Having
    // the ability to reset counters is important to help prevent
    // the counter from being a memory leak.

As mentioned above, the [specification for the console API](https://console.spec.whatwg.org) doesn’t explicitly define a function to reset the counts for a label. I thought this was pretty interesting considering that the standard defines a specification for the `timeEnd` function associated with the `time` function. In any case, this standard is a living standard so there’s plenty of time for it to be added.

And that’s that! The `Console` object is less complicated than some other functions to analyze but I did discover some new uses while reading through the code.

If you have any questions or comments about the above, feel free to [ask me a question](https://blog.safia.rocks/ask) or [reach out to me on Twitter](https://twitter.com/captainsafia).

