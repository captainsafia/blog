---
layout: post
title: Discovering async hooks
date: '2018-02-07T10:15:04-08:00'
tags:
- node-module-deep-dive
tumblr_url: https://blog.safia.rocks/post/170614460245/discovering-async-hooks
---
So the other day, I was poking around the documentation for Node.JS when I accidentally clicked on something in the navigation bar titled [“Async Hooks”](https://nodejs.org/dist/latest-v9.x/docs/api/async_hooks.html). I was intrigued. I scrolled quickly through the documentation to see if I could get anything from a cursory glance at it and made a mental note to learn more about it later.

And that’s what brings me here! I figured I would dive into this async hooks business and see what was up.

As it turns out, async hooks are currently an experimental feature within the Node. That means that the interface for their API might be changed dramatically OR that they might be removed from Node altogether. So yeah, this is cutting edge stuff. Don’t trust your production code with it just yet!

The documentation states the following.

> The `async_hooks` module provides an API to register callbacks tracking the lifetime of asynchronous resources created inside a Node.js application.

Interesting! So, if I were to put the statement above in simple terms. Async hooks allow you to hook into events that occur within asynchronous resources. The documentation describes examples of an HTTP server resource or a file reader resource. For example, an event that might correlate with an asynchronous HTTP server is a new connection. Similarly, an event that might occur multiple times with a file I/O resource is a write to a file. So with async hooks, you can do something like send a notification every time someone connects to your HTTP server or send an email every time someone writes to a file. It’s basically a way to plugin to the asynchronous event lifecycle in Node.

At this point, I was curious to see how the `async_hooks` module works, so I headed over to my trusty old friend, the NodeJS codebase. The core logic for the `async_hooks` module is defined [here](https://github.com/nodejs/node/blob/bff5d5b8f0c462880ef63a396d8912d5188bbd31/lib/async_hooks.js). If you look at the commit history for this file, you’ll notice that the first commit was pushed out in May 2017. That’s pretty new with respect to a lot of things that you see in the Node codebase.

The [public API](https://github.com/nodejs/node/blob/bff5d5b8f0c462880ef63a396d8912d5188bbd31/lib/async_hooks.js#L205-L208) for the `async_hooks` module consists of three different functions, so I figured I would start diving into those.

    module.exports = {
      // Public API
      createHook,
      executionAsyncId,
      triggerAsyncId,
      // Embedder API
      AsyncResource,
    };

The first function `createHook` is responsible for creating a new AsyncHooks object from the parameters that the user provides.

    function createHook(fns) {
      return new AsyncHook(fns);
    }

The parameters that the user provides are a set of functions, `fns`, that define callbacks to be executed at different stages of the asynchronous resources lifespan. For example, there is an `init` callback that is invoked when a new asynchronous resource (like an HTTP server) is about to be created and a `before` callback that is invoked when a new asynchronous event (like a connection to an HTTP server) occurs.

The `executionAsyncId` seems to return some data from a lookup in an associative array.

    function executionAsyncId() {
      return async_id_fields[kExecutionAsyncId];
    }

Some snooping in the docs reveals that it returns the `asyncId` from the current execution context. So basically, this value gives insights into where the asynchronous resource is currently. For example, the asyncId will differ if the resource has just been initialized or if the resource has just had an asynchronous event occur.

There’s another function related to `asyncId`s that is exported by the public API. The `triggerAsyncId` function which also returns data from a table lookup.

    function triggerAsyncId() {
      return async_id_fields[kTriggerAsyncId];
    }

From the description of the function in the documentation, I figured that this function returns the ID of the function that invoked the callback that is currently being executed. Basically, it gives you a handy way of figuring out the “parent” of the child callback. I’m guessing that you can probably use `executionAsyncId` and `triggerAsyncId` as debugging tools to track the state of callback invocations in your application at a given time.

There’s another dimension to this `async_hooks` module. It’s the C++ dimension. Like many important modules in the Node ecosystem, there is a lot of C++ code doing the heavy lifting and making the magic happen. I’ll forgo diving into what the C++ implementation of `async_hooks` hold but I’ll look into it in another blog post.

Stay tuned!

