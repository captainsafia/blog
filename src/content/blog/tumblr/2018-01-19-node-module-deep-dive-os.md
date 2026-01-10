---
layout: post
title: 'Node module deep-dive: os'
date: '2018-01-19T10:00:27-08:00'
tags:
- node-module-deep-dive
tumblr_url: https://blog.safia.rocks/post/169888553343/node-module-deep-dive-os
---
So, I’ve been reading through the Node codebase for a while now and I’m starting to get a decent good sense of how the Node main process works, how different modules work, and the interactions between the C++ and JavaScript portions of the codebase. Emphasis on the “decent” here. The Node codebase is pretty darn complex and I’ve been doing my best to get acquainted with it.

The being said, I figured that it would be interesting to figure out how the entire module lifecycle worked in Node by examining one of the built-in modules, `os`.

If you are unfamiliar with `os`, it is a Node module that allows the developer to get things like the system architecture or hostname. Here’s an example of the outputs I got when I ran it on my personal machine.

    > const os = require('os');
    undefined
    > os.arch();
    'x64'
    > os.homedir();
    '/Users/captainsafia'
    > os.hostname();
    'eniac'

Nifty, right?

You can find the JavaScript source for the `os` module [here](https://github.com/nodejs/node/blob/f2e62b52385ff5e778d997ba86db70975e5670c7/lib/os.js). I’m not actually particularly interest in reading through any functions in the JavaScript code at the moment. The one thing that I am interested in is the `process.binding` that binds to the module object created in the C++ portions of the code.

    const {
      getCPUs,
      getFreeMem,
      getHomeDirectory: _getHomeDirectory,
      getHostname: _getHostname,
      getInterfaceAddresses: _getInterfaceAddresses,
      getLoadAvg,
      getOSRelease: _getOSRelease,
      getOSType: _getOSType,
      getTotalMem,
      getUserInfo: _getUserInfo,
      getUptime,
      isBigEndian
    } = process.binding('os');

From this, we can see that the object contains a lot of functions that are later invoked in parts of the public API of the `os` module. The first thing that I wanted to do was try and figure out where exactly the functions listed above were defined. I did some searching around the codebase and found the C++ definitions of the `os` functions defined [here](https://github.com/nodejs/node/blob/12c8b4d15471cb6211b39c3a2ca5b10fa4b9f12b/src/node_os.cc). For example, here is the definition of the `GetOSType`/`getOSType` function mentioned above.

    static void GetOSType(const FunctionCallbackInfo<Value>& args) {
      Environment* env = Environment::GetCurrent(args);
      const char* rval;
    
    #ifdef __POSIX__
      struct utsname info;
      if (uname(&info) < 0) {
        CHECK_GE(args.Length(), 1);
        env->CollectExceptionInfo(args[args.Length() - 1], errno, "uname");
        return args.GetReturnValue().SetUndefined();
      }
      rval = info.sysname;
    #else // __MINGW32__
      rval = "Windows_NT";
    #endif // __POSIX__
    
      args.GetReturnValue().Set(OneByteString(env->isolate(), rval));
    }

Basically, this function uses the `uname` [function](http://)[https://www.systutorials.com/docs/linux/man/1-uname/](https://www.systutorials.com/docs/linux/man/1-uname/) in Unix to get information about the operating system and to extract the operating system type from it. It also has some conditional logic to evaluate whether it is running on a Unix system or a Windows system.

    args.GetReturnValue().Set(OneByteString(env->isolate(), rval));

The return statement, as seen above, is not the traditional `return` that you might see in C++ code. I recall from a book on how to develop Native Nod extensions that I skimmed through a long-time ago, that this special return code is what allows the JavaScript portions of the codebase to have access to the returned data from the C++ module. The most interesting portion of the code is actually all the way at the bottom.

    void Initialize(Local<Object> target,
                    Local<Value> unused,
                    Local<Context> context) {
      Environment* env = Environment::GetCurrent(context);
      env->SetMethod(target, "getHostname", GetHostname);
      env->SetMethod(target, "getLoadAvg", GetLoadAvg);
      env->SetMethod(target, "getUptime", GetUptime);
      env->SetMethod(target, "getTotalMem", GetTotalMemory);
      env->SetMethod(target, "getFreeMem", GetFreeMemory);
      env->SetMethod(target, "getCPUs", GetCPUInfo);
      env->SetMethod(target, "getOSType", GetOSType);
      env->SetMethod(target, "getOSRelease", GetOSRelease);
      env->SetMethod(target, "getInterfaceAddresses", GetInterfaceAddresses);
      env->SetMethod(target, "getHomeDirectory", GetHomeDirectory);
      env->SetMethod(target, "getUserInfo", GetUserInfo);
      target->Set(FIXED_ONE_BYTE_STRING(env->isolate(), "isBigEndian"),
                  Boolean::New(env->isolate(), IsBigEndian()));
    }
    
    } // namespace os
    } // namespace node
    
    NODE_BUILTIN_MODULE_CONTEXT_AWARE(os, node::os::Initialize)

So here, it looks like we are initializing the mappings between the functions we’ve written on the C++ level and the names that we’ll refer to them with when we are binding to the `os` module. The one thing I was curious about was what was going on in the `NODE_BUILTIN_MODULE_CONTEXT_AWARE` macro function. It looks like we are passing to it the `os` namespace, which contains all the functions defined in this C++ file, and the initialization function. I did some searching around the codebase and found the code for `NODE_BUILTIN_MODULE_CONTEXT_AWARE` [here](https://github.com/nodejs/node/blob/f3cd53751ba3f917a0996a8f38c991242a8fbc76/src/node_internals.h#L155).

    #define NODE_BUILTIN_MODULE_CONTEXT_AWARE(modname, regfunc) \
      NODE_MODULE_CONTEXT_AWARE_CPP(modname, regfunc, nullptr, NM_F_BUILTIN)

So it looks like this macro function, invokes the `NODE_MODULE_CONTEXT_AWARE_CPP` macro function, which is defined in the same file and has the following definition.

    #define NODE_MODULE_CONTEXT_AWARE_CPP(modname, regfunc, priv, flags) \
      static node::node_module _module = { \
        NODE_MODULE_VERSION, \
        flags, \
        nullptr, \
        __FILE__ , \
        nullptr, \
        (node::addon_context_register_func) (regfunc), \
        NODE_STRINGIFY(modname), \
        priv, \
        nullptr \
      }; \
      void _register_ ## modname() { \
        node_module_register(&_module); \
      }

Oh! This macro function is creating that `node_module` struct that I discovered in [the last blog post](https://blog.safia.rocks/2018-01-17-how-does-node-load-built-in-modules/). It turns out that the registration function that is invoked when a module is registered is actually the `Initialize` function above which loads the function associations onto the current environments. IT’S ALL STARTING TO MAKE SENSE.

So here is the story of the lifecycle of a built-in module from what I can understand.

- A collection of functions are defined under a namespace for that particular module on the C++ end of the code. For example, the `GetOSType` function is defined under the `os` namespace.
- The module is registered onto the current process using a collection of macro functions. This registration involves mapping the functions defined above to a collection of names that we can use to refer to them when we extract the bindings.
- The JavaScript code associated with a particular module extracts registered names for the functions from the running process using `process.binding`.
- The functions extracted using `process.binding` are invoked in the functions that are exported as part of the public API in the JavaScript module. For example, the `os.type()` JavaScript function call ultimately relies on teh `getOSType` binding which refers to the `GetOSType` function defined in C++.

This is making sense for me so far. There are definitely some parts of it that I don’t understand. Mostly, I’m curious to know what the scope of this `process` object is. It feels to me like the key to understanding the connections between the native C++ and the JavaScript code is getting a solid sense of what `process` is. Perhaps I’ll dig into that at another time…

If you have any questions or feedback on this post, you can [reach out to me on Twitter](https://twitter.com/captainsafia).

