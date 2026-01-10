---
layout: post
title: How does the Node main process start?
date: '2018-01-15T09:21:07-08:00'
tags:
- node-deep-dive
tumblr_url: https://blog.safia.rocks/post/169734955505/how-does-the-node-main-process-start
---
OK! So in [one of my previous blog posts](https://blog.safia.rocks/2018-01-10-how-does-processbinding-in-node-work/), I tried to figure out how the Node main process is initialized. I ended up not being successful in that endeavor. As it turns out, the slide deck I was using as documentation to guide my code reading was a little out of date and referenced some parts of the code base that were moved. Thankfully, one of Node’s maintainers (@Fishrock123) clarified this for me [on Twitter](https://twitter.com/fishrock123/status/951515801240199169) and guided me towards the correct file. So now I know the right place to start!

As it turns out, [`src/node_main.cc`](https://github.com/nodejs/node/blob/858b48b692dd04e5134c02f23efac94c4e678329/src/node_main.cc) is where it all starts. Let’s dive into it!

_cue dramatic music_

If you’re familiar with C/C++, then the structure of this file is pretty easy to grasp. The `main` function is the function that is automatically executed on program start by the compiler. The last line of this function lets us know that we are passing all our arguments and parameters to the `node:Start` function.

    return node::Start(argc, argv);

I did some searching around the header and source files and found the definition of the `node:Start` function [here](https://github.com/nodejs/node/blob/8938c4c22d720c33441ce95d801056532b99ec18/src/node.cc#L4547). This function is not actually that big when you consider the number of lines of code it contains, but that’s because it mostly invokes other functions that are responsible for bootstrapping the Node process. Here, let me explain what I mean. The first couple of lines in the function look like this.

    atexit([] () { uv_tty_reset_mode(); });
    PlatformInit();
    node::performance::performance_node_start = PERFORMANCE_NOW();

The `atexit` bit drew my attention. I had seen this function used in other systems-level code but only had a vague idea as to what it did. Something about exit handling. I decided to do more research this time around and discovered that it was responsible for figuring out what to do when the current process exits. In this case, when the node process exits, the `uv_tty_reset_mode` function will be called. I didn’t know what this function did. Although by now, I knew the fact that it had a `uv` prefix meant that it was related to `libuv`, the little async I/O library in some way. I did some digging in the documentation for `libuv` and found some details about it [here](http://docs.libuv.org/en/v1.x/tty.html#c.uv_tty_reset_mode). So basically, when you exit the Node process your TTY settings are also reset.

Side note: TTY stands for “TeleTYpewriter” and is a legacy carried from the Olden Days. Teletypewriters were peripherals that were used to connect to computer. [Here](https://media.gettyimages.com/photos/teletypewriter-picture-id128576603) is a picture of somebody using one. I always find these little terminology carry-overs from the early days of technology to be quite amusing. Naming things is hard so why think of new names for everything when you can just use the old one?

The next bit of code invokes the `PlatformInit` [function](https://github.com/nodejs/node/blob/8938c4c22d720c33441ce95d801056532b99ec18/src/node.cc#L4062). I saw a lot of comments around “file descriptors” and “signals.” I’m not going to pretend to know what those things are now but I’m taking an Operating Systems course at the moment, so I might be able to speak about them more intelligently in the future! For now, I’m gonna say that this function is basically responsible for initializing some platform-dependent stuff. Good enough for me!

The next big function that is invoked is the `Init` function.

    Init(&argc, const_cast<const char**>(argv), &exec_argc, &exec_argv);

From reading the code for the Init [function](https://github.com/nodejs/node/blob/8938c4c22d720c33441ce95d801056532b99ec18/src/node.cc#L4192), I discovered that is responsible for doing things like registering the built-in modules, passing the V8 configuration flags that the developer provides at the command line to V8, and configuring some other environment variables. The one function invocation that caught my attention here is this one.

    node::RegisterBuiltinModules();

I think it would be interesting to figure out what goes on in here in further detail but I might do that at a later time. Don’t wanna bite off more than I can chew!

Finally, the last few lines of code in this function are responsible for doing a lot of work related to V8.

    V8::Initialize();
    node::performance::performance_v8_start = PERFORMANCE_NOW();
    v8_initialized = true;
    const int exit_code =
      Start(uv_default_loop(), argc, argv, exec_argc, exec_argv);
    if (trace_enabled) {
      v8_platform.StopTracingAgent();
    }
    v8_initialized = false;
    V8::Dispose();
    
    // uv_run cannot be called from the time before the beforeExit callback
    // runs until the program exits unless the event loop has any referenced
    // handles after beforeExit terminates. This prevents unrefed timers
    // that happen to terminate during shutdown from being run unsafely.
    // Since uv_run cannot be called, uv_async handles held by the platform
    // will never be fully cleaned up.
    v8_platform.Dispose();

So it looks like V8 is initialized, then a polymorphic definition of the `Start` function is invoked with the event loop passed through. Then there is some funny business going on with the tracing agent in V8.

Side note: If you try to Google “tracing agent” to learn more about tracing agents you will get a completely unexpected result. In other news, you can apparently hire an international manhunt team off the Internet. Isn’t technology wonderful?

I did some more research about the tracing agent and found [this](https://github.com/v8/v8/wiki/Tracing-V8) rather helpful Wiki document. So it appears that tracing is a fairly new feature in V8. Essentially, this bit of code is responsible for configuring whatever custom code is necessary for the special logging that V8’s tracer uses. That makes sense.

The next two lines were a little weird to me.

    v8_initialized = false;
    V8::Dispose();

We just initialized the V8 interpreter but now we are setting it as initialized and disposing of it. Say what? To figure out what was going on here, I decided to head into the history of the code file and see when those changes had been introduced into the code base and found [this commit](https://github.com/nodejs/node/commit/27b268b8c13d4ca27a0755cc02446fb78886a3bf) from about 9 years ago. From the commit, it looks like the `V8:Dispose` line was actually added back into the code base after it was causing some errors with a particular test. This still didn’t give me good insights into why it was being disposed, so I decided to figure out what the `V8:Dispose` function actually does.

I found [some documentation](https://v8.paulfryzel.com/docs/master/classv8_1_1_v8.html#af761970f495ed98e940808fd4fa5caff) that explained that `V8:Dispose` is responsible for releasing any resources that were used by V8. I’m starting to thing that what is going on here is the fact that the Node process actually gets cleaned up in the `Start` function. So the polymorphic `Start` function invoked here.

    const int exit_code =
      Start(uv_default_loop(), argc, argv, exec_argc, exec_argv);

Runs until you exit from Node. At which point, you need to do all the cleanup of the V8 engine as well as halt the tracing agent used by V8. This makes sense. To validate this assumption, I would have to go in and read the code for the invoked `Start` function.

As usual, I leave my code read more confused and uninformed than when I started! There is actually a lot of places I can go from here. Despite only being about 50 lines of code (with comments and newlines), this function is giving me ideas for a lot of things I want to explore with the Node interpreter.

- How are built-in modules loaded?
- What exactly is `PlatformInit` doing? What’s going on with all those file descriptors and signals?
- What do all the polymorphic variations of the `Start` function do?

I’ll try to pick these apart in other blog posts.

This whole process has been quite interesting. The C/C++ portion of this code base is rather gnarly. Especially for me, I’ve only ever utilized C/C++ in an academic context so reading this “industry-strength” code has been rather interesting.

It also goes to show that everyone maintaining Node is doing some truly rigorous and awesome technical work and that we should all love and praise them dearly!

