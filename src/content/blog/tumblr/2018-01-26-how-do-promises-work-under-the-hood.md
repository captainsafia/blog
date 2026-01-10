---
layout: post
title: How do Promises work under the hood?
date: '2018-01-26T10:27:44-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/170154422915/how-do-promises-work-under-the-hood
---
So, I know I said I wanted to take a break from these code reads for a little bit but curiosity got the best of me.

I was recently doing an on-site interview for a job. Yes, I still haven’t found a job and I’m graduating college in just a couple of weeks. I’m trying not to think (or panic) about it. Anyways, during one of the phases of the interview, I was tasked with implementing the internals of the JavaScript `Promise` object. After I finished my interview, I decided that I really wanted to figure out how Promises actually worked under the hood.

So I’m going to look into it!

Before we start, it might help if you knew a little bit more about what Promises were. If you are not familiar you can check out [this quick explainer](https://www.promisejs.org) or [the MDN docs on Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).

For this situation, I decided to look through [the most popular Promises implementation](https://github.com/then/promise) in the JavaScript implementation.

So the codebase for this particular project is a lot smaller than the codebase for Node, which was good news for me! The core logic is stored in the [`src/core.js`](https://github.com/then/promise/blob/bbf5c443af8fbf1992dc669c8f0868fba6dbd428/src/core.js) source file. In this file, the Promise object is defined.

So to start off, a Promise is constructed using a function that is passed into the constructor. Within the constructor, there are a couple of internal variables that are initialized and then the `doResolve` function is invoked.

    function Promise(fn) {
      if (typeof this !== 'object') {
        throw new TypeError('Promises must be constructed via new');
      }
      if (typeof fn !== 'function') {
        throw new TypeError('Promise constructor\'s argument is not a function');
      }
      this._deferredState = 0;
      this._state = 0;
      this._value = null;
      this._deferreds = null;
      if (fn === noop) return;
      doResolve(fn, this);
    }

The `doResolve` function takes the function that is passed in the Promise’s constructor and a reference to the current Promise. So I hopped over to the definition of the `doResolve` function and tried to figure out what was going on there. So it seems like the function will invoke another function called `tryCallTwo` that takes two callbacks. One callback is executed when some value is successfully returned and the other is executed when there is an error. If the callback executed successfully, the `resolve` function is invoked with the Promise object and the value, otherwise, the `reject` function is invoked.

    function doResolve(fn, promise) {
      var done = false;
      var res = tryCallTwo(fn, function (value) {
        if (done) return;
        done = true;
        resolve(promise, value);
      }, function (reason) {
        if (done) return;
        done = true;
        reject(promise, reason);
      });
      if (!done && res === IS_ERROR) {
        done = true;
        reject(promise, LAST_ERROR);
      }
    }

So the next thing that I figured I would do is to get a better sense of what `tryCallTwo` is doing. It actually turned out to be pretty simple enough. Basically, it is a light wrapper function that invokes the first parameter it is given (which is a function) with the second two parameters as arguments.

    function tryCallTwo(fn, a, b) {
      try {
        fn(a, b);
      } catch (ex) {
        LAST_ERROR = ex;
        return IS_ERROR;
      }
    }

So essentially, with all of this, we pass the function that the user invokes when they create a Promise object. That’s the one that looks like this.

    new Promise((resolve, reject) => {
      // some code goes here
    });

It’s invoked with the two callbacks that are defined above. They, in turn, go on to invoke the `resolve` and `reject` functions that are defined globally in this file. I decided to check out what `resolve` was doing in this particular case.

The function starts off with a quick data check. The value you are trying to resolve can’t be the Promise that you are trying to resolve itself.

    function resolve(self, newValue) {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) {
        return reject(
          self,
          new TypeError('A promise cannot be resolved with itself.')
        );
      }

Then the function checks to see if the newValue is an object or a function. If it is, it tries to get the `then` function defined on it using the `getThen` helper function.

    if (
      newValue &&
      (typeof newValue === 'object' || typeof newValue === 'function')
    ) {
      var then = getThen(newValue);
      if (then === IS_ERROR) {
        return reject(self, LAST_ERROR);
      }

At this point, the function does another check to see if `newValue` is a promise. This is essentially checking for the case where you return a Promise in your `then` because you are chaining multiple `then`s together. It also does some work to set the internal variables that were initialized earlier.

    if (
      then === self.then &&
      newValue instanceof Promise
    ) {
      self._state = 3;
      self._value = newValue;
      finale(self);
      return;

Finally, it attempts to resolve the function again with the new value that has been returned.

    else if (typeof then === 'function') {
      doResolve(then.bind(newValue), self);
      return;
    }

I was actually pretty happy to see that the code for the Promise object was similar in a lot of ways to what I had implemented in my interview. That was a relief!

I found the way it handled chained `then`s to be pretty interesting. That was actually one of the things that I got stuck on in my interview and seeing the simplicity of the approach used in this implementation of Promise made me feel intellectually satisfied.

Alas, my curiosity has been satiated! I hope you enjoyed this post!

