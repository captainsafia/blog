---
layout: post
title: 'Node module deep-dive: child_process'
date: '2018-01-05T09:03:09-08:00'
tags:
- node-module-deep-dive
tumblr_url: https://blog.safia.rocks/post/169346741925/node-module-deep-dive-childprocess
---
Hi there, friends!

That’s right! I’m back with another Node module deep-dive. Like I mentioned in my last post, I’m hoping to spend the rest of the month published annotated code reads on portions of the Node codebase. I was hoping to release them on Monday, Wednesday, and Friday and I’m pretty proud of myself for keeping that promise. So without further ado….

It’s time to read (and annotate) some code! For this post, I started by asking myself a pretty basic question. What happens when you execute a command using `child_process.exec`? For those of you who might be unfamiliar, `child_process.exec` is a function that gives you the ability to execute shell commands from Node. You can do things like this.

    > const { exec } = require('child_process');
    undefined
    > exec('echo "Hello there!"', (error, stdout, stderr) => {
    ... if (error) console.log(error);
    ... console.log(`${stdout}`);
    ... console.log(`${stderr}`);
    ... });
    > Hello there!

Pretty neat, huh? I think so. I used this command quite a bit when I was building [giddy](https://github.com/captainsafia/giddy), a little Node CLI that added some useful features to git.

As I usually do, I headed over to the Node.js repo on GitHub and navigated to the [source file for child\_process](https://github.com/nodejs/node/blob/0a842633861cf20527ce93e6bf58b4ece1b168be/lib/child_process.js). In the last few posts, I started my code read by examining the exports of the module. In this case, I have a pretty good idea of what to look for so I headed straight for the definition of the `exec` command on the module.

    exports.exec = function(command /*, options, callback*/) {
      var opts = normalizeExecArgs.apply(null, arguments);
      return exports.execFile(opts.file,
                              opts.options,
                              opts.callback);
    };

I thought it was pretty interesting that although the `exec` command takes in three parameters (the `command` to execute, the `options` to use, and the `callback` to invoke) it was set up to only take in one parameter. It appears that to extract the three parameters, the `normalizeExecArgs` function is invoked on the `arguments` object. The `normalizeExecArgs` then extracts each of the fields passed in the `arguments` object to an Object with an appropriate label.

    function normalizeExecArgs(command, options, callback) {
      if (typeof options === 'function') {
        callback = options;
        options = undefined;
      }
    
      // Make a shallow copy so we don't clobber the user's options object.
      options = Object.assign({}, options);
      options.shell = typeof options.shell === 'string' ? options.shell : true;
    
      return {
        file: command,
        options: options,
        callback: callback
      };
    }

I thought this was a pretty strange thing to do. In other portions of the codebase, this type of check — the one used to properly match up whether a function was called with a command and callback but no options or a command and options but no callback and so on — is usually done within the function body. Here, it appears to have been delegated to an external utility function. This function (`normalizeExecArgs`) is invoked twice, once in `exec` and once in `exec` sync so that handling logic might have been extracted there in order to keep the code DRY. In any case, when all is said and done it now appears that we’ve got a variable `opts` that contains an object with the command we want to execute, the options we want to execute it with, and the callback to invoke.

The `exec` function passes these options to the `execFile` function….which is a whopping 193 lines of code! It’s OK. I’m a brave woman and I have done these code reads seven times before so I can definitely handle this. Are you ready? Alright, let’s go.

The first couple of lines of the `execFile` command seem to be doing some basic options setup and _more_ `arguments` parsing. At this point, I was a little confused as to why the positional arguments needed to be passed again considering they had just been parsed in the `exec` function. This is unusual, but I won’t let it keep my up at night, onwards we go…

So at this point, we’ve got —

Oh wait! Stop! I just realized why there was an aditional set of parsing logic in `execFile`. Althought `execFile` is only invoked internally within the `child_process` module by the `exec` function it is an exported function that might be invoked by the developer. As a result, the function needs to parse the arguments provided by the developer as well. I got so in the weeds with my trail of thinking involving `exec` invoking `execFile` that I forgot `execFile` is part of the public API. OK, where was I?

So at this point, we’ve got an options object and a callback to invoke. The next couple of lines validate and santize developer-provided options.

    // Validate the timeout, if present.
    validateTimeout(options.timeout);
    
    // Validate maxBuffer, if present.
    validateMaxBuffer(options.maxBuffer);
    
    options.killSignal = sanitizeKillSignal(options.killSignal);

The next line invokes `spawn` with the given parameters and arguments.

    var child = spawn(file, args, {
      cwd: options.cwd,
      env: options.env,
      gid: options.gid,
      uid: options.uid,
      shell: options.shell,
      windowsHide: !!options.windowsHide,
      windowsVerbatimArguments: !!options.windowsVerbatimArguments
    });

`spawn` is a quick little function that creates a new ChildProcess object and invokes its `spawn` function with the parameters passed to it.

Sidenote: Maybe I’ll do a code read of the ChildProcess object at some point. It’s not on my list of things to read through right now but let me know if you’d be interested in seeing a post on it [on Twitter](https://twitter.com/captainsafia).

    var spawn = exports.spawn = function(/*file, args, options*/) {
      var opts = normalizeSpawnArguments.apply(null, arguments);
      var options = opts.options;
      var child = new ChildProcess();
    
      debug('spawn', opts.args, options);
    
      child.spawn({
        file: opts.file,
        args: opts.args,
        cwd: options.cwd,
        windowsHide: !!options.windowsHide,
        windowsVerbatimArguments: !!options.windowsVerbatimArguments,
        detached: !!options.detached,
        envPairs: opts.envPairs,
        stdio: options.stdio,
        uid: options.uid,
        gid: options.gid
      });
    
      return child;
    };

Once this ChildProcess object has been created, the remaining portions of the `execFile` function body are largely responsible for configuring the event handlers on the new ChildProcess object. For example, attaches an exit handler to the child process that listens to exit events and invokes the callback function passed as a parameter to the `execFile` function. It aslo attaches an error handler that properly encodes `stderr` based on the encoding provided by the developer in the options parameter.

    child.addListener('close', exithandler);
    child.addListener('error', errorhandler);

All in all, the `exec` function in the `child_process` module is a wrapper around the `execFile` function which in turn extends upon some of the work done by the `spawn` function in the `child_process` module which relies on the `spawn` logic implemented in the `ChildProcess` object. Cutting up that onion didn’t sting as bad as I thought it would.

If you have any questions or comments about the above, feel free to [reach out to me on Twitter](https://twitter.com/captainsafia).

