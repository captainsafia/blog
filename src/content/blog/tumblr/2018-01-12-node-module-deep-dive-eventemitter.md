---
layout: post
title: 'Node module deep-dive: EventEmitter'
date: '2018-01-12T08:58:35-08:00'
tags:
- node-module-deep-dive
tumblr_url: https://blog.safia.rocks/post/169618575955/node-module-deep-dive-eventemitter
---
So, I got pretty in the weeds with some C++ code in my [last Node-related blog post](https://blog.safia.rocks/2018-01-10-how-does-processbinding-in-node-work/) and I figured I would get back into my comfort zone with some more JavaScript reading.

When I first started to learn Node, once of the things that I had trouble grasping was the event-driven nature of the language. I hadn’t really interacted much with event-driven programming languages. Well, in hindsight, I guess I have. Prior to learning Node, I had used jQuery’s `.on` and `.click` in my code, which is an event-driven programming style. At that point, it hadn’t really hit me that I was writing event-driven code. Anyways, one of the things I’ve been curious to dive into for a while now is the event emitter in Node. So let’s do that.

If you aren’t familiar with Node’s event-driven nature, there are a couple of blog posts you can check out that explain it much better than I can. Here’s a few that might be helpful to you.

- [Understanding Node.js Event-Driven Architecture](https://medium.freecodecamp.org/understanding-node-js-event-driven-architecture-223292fcbc2d)
- [event driven architecture node.js](https://garywoodfine.com/event-driven-architecture-node-js/)
- [Understanding the Node.js Event Loop](http://nodesource.com/blog/understanding-the-nodejs-event-loop/)
- [Events documentation in Node.js](https://nodejs.org/api/events.html)

OK! So I wanna read the code for the EventEmitter and see if I can grok what’s going under the hood with the `EventEmitter` class. You can find the code that I am going to be referencing [here](https://github.com/nodejs/node/blob/61b4d60c5d9694e79069b1680b3736c96a5de501/lib/events.js).

So the two most critical functions in any `EventEmitter` object are the `.on` function and the `.emit` function. The `.on` function is the function that is responsible for listening to an event of a particular type. The `.emit` function is responsible for dispatching events of a particular type. I decided to start my exploration by diving into the code for these particular functions. I’m gonna start with `.emit` since it makes sense to see how events are emitted before looking at how they are listened to.

So the function declaration for `emit` is pretty self-explanatory if you’ve worked with EventEmitter objects. It takes in a type argument, which is usually a string, and a set of arguments that will be passed to the handler.

    EventEmitter.prototype.emit = function emit(type, ...args) {

The first thing I noticed in this particular code is that “error”-type events and events of other types are handled differently. To be honest, it took me a while to grok what was happening exactly in the code below, especially the little `if-else if` bit. So basically, what this bit of code does is check to see if the event that is being emitted is an error. If it is, it checks to see if there is a listener for `error` events in the set of listeners attached to the `EventEmitter`. If there is a listener attached, the function returns

    let doError = (type === 'error');
    
    const events = this._events;
    if (events !== undefined)
      doError = (doError && events.error === undefined);
    else if (!doError)
      return false;

If there is no event listener (as the comment states), then the emitter will throw an error to the user.

    // If there is no 'error' event listener then throw.
    if (doError) {
      let er;
      if (args.length > 0)
        er = args[0];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      // At least give some kind of context to the user
      const errors = lazyErrors();
      const err = new errors.Error('ERR_UNHANDLED_ERROR', er);
      err.context = er;
      throw err;
    }

On the other hand, if the type that is being thrown is not an error, then the `emit` function will look through the listeners attached on the EventEmitter object to see if any listeners have been declared for that particular `type` and invoke them.

    const handler = events[type];
    
    if (handler === undefined)
      return false;
    
    if (typeof handler === 'function') {
      Reflect.apply(handler, this, args);
    } else {
      const len = handler.length;
      const listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        Reflect.apply(listeners[i], this, args);
    }
    
    return true;

Neat-o! That was pretty straightforward. On to the `on` function…

The `on` function in the EventEmitter implicitly invokes the `_addListener` internal function which is defined with a declaration as follows.

    function _addListener(target, type, listener, prepend)

Most of these parameters are self-explanatory, the only curious one for me was the `prepend` parameter. As it turns out, this parameter defaults to `false` and is not configurable by the developer through any public APIs.

Side note: Just kidding! I came across some GitHub commit messages that cleared this up. It appears that it is set to false in the `_addListener` object because a lot of developers were inappropriately accessing the internal `_events` attribute on the EventEmitter object to add listeners to the beginning of the list. If you want to do this, you should use `prependListener`.

The `_addListener` function starts off by doing some basic parameter-validation. We don’t want anyone to shoot themselves in the foot! Once the parameters have been added, the function attempts to add the `listener` for `type` to the `events` attribute on the current `EventEmitter` object. One of the bits of code that I found interesting was the code below.

    if (events === undefined) {
      events = target._events = Object.create(null);
      target._eventsCount = 0;
    } else {
      // To avoid recursion in the case that type === "newListener"! Before
      // adding it to the listeners, first emit "newListener".
      if (events.newListener !== undefined) {
        target.emit('newListener', type,
                    listener.listener ? listener.listener : listener);
    
        // Re-assign `events` because a newListener handler could have caused the
        // this._events to be assigned to a new object
        events = target._events;
      }
      existing = events[type];
    }

I’m particularly curious about the `else` here. So it looks like if the `events` attribute has already been initialized on the current EventEmitter object (meaning that we’ve already added a listener before), there is some funky edge-case checking business going on. I decided to do some GitHub anthropology to figure out when this particular code change had been added to get some more context into how the bug emerged and why it was added. I quickly realized this was a bad idea because this particular bit of logic has been in the code for about 4 years and I had trouble tracking down when it originated. I tried to read the code more closely to see what type of edge case this was checking for exactly.

I eventually figured it out not by reading code, but by reading documentation. Don’t forget to eat your vegetables and read all the docs, kids! The Node documentation states:

> All EventEmitters emit the event `'newListener'` when new listeners are added and `'removeListener'` when existing listeners are removed.

So basically, the `newListener` event is emitted when a new listener is added _before_ the actually listener is added to the `_events` attribute on the EventEmitter. This is the case because if you are adding a `newListener` event listener and it is added to the list of events before `newListener` is emitted by default then it will end up invoking itself. This is why this `newListener` emit code is placed at the top of the function.

The next bit of code tries to figure out whether a listener for this `type` has already been attached. Basically, what this is doing is making sure that if there is only one listener for an event then it is set as a function value in the `_events` associative array. If they are more than one listeners, it is set as an array. It is a minor optimizations, but many minor optimizations are what make Node great!

    if (existing === undefined) {
      // Optimize the case of one listener. Don't need the extra array object.
      existing = events[type] = listener;
      ++target._eventsCount;
    } else {
      if (typeof existing === 'function') {
        // Adding the second element, need to change to array.
        existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
        // If we've already got an array, just append.
      } else if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }

The last check made in this function tries to confirm whether or not there were too many listeners attached on a particular event emitter for a particular event type. If this is the case, it might mean that there is an error in the code. In general, I don’t think it is good practice to have many listeners attached to a single event so Node does some helpful checking to warn you if you are doing this.

      // Check for listener leak
      if (!existing.warned) {
        m = $getMaxListeners(target);
        if (m && m > 0 && existing.length > m) {
          existing.warned = true;
          // No error code for this since it is a Warning
          const w = new Error('Possible EventEmitter memory leak detected. ' +
                              `${existing.length} ${String(type)} listeners ` +
                              'added. Use emitter.setMaxListeners() to ' +
                              'increase limit');
          w.name = 'MaxListenersExceededWarning';
          w.emitter = target;
          w.type = type;
          w.count = existing.length;
          process.emitWarning(w);
        }
      }
    }

And that’s it! At the end of all this, this `.on` function returns the EventEmitter object it is attached to.

I really liked reading the code for the EventEmitter. I found that it was very clear and approachable (unlike the C++ adventure I went on last time) — although I suspect this has to do a fair bit with my familiarity with the language.

