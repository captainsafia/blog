---
layout: post
title: How does Node load built-in modules?
date: '2018-01-17T09:51:26-08:00'
tags:
- node-deep-dive
tumblr_url: https://blog.safia.rocks/post/169813535760/how-does-node-load-built-in-modules
---
Addendum: After I published this blog post, I got [some feedback](https://twitter.com/fishrock123/status/953671426996924418) from one of Node’s maintainers about some of the things I mentioned. In the post below, the things that I and the code refer to as “built-in modules” are actually bindings, which are JavaScript objects created by C++ that represent a module. It appears that due to some legacy reasons, they are referred to as “built-in modules” in the actual code. In reality this blog post should be titled **“How does Node reigster module bindings?”** I can’t change the title without messing up a lot of hyperlinks so I’ll just leave this addendum here. Alright, enjoy the article!

So, in the [last blog post](https://blog.safia.rocks/2018-01-15-how-does-the-node-main-process-start/) that I wrote, I started looking at how the Node main process was initialized. I quickly discovered that there was quite a lot going on in there (and rightfully so!). One of the things that caught my eye in particular was the [reference](https://github.com/nodejs/node/blob/8938c4c22d720c33441ce95d801056532b99ec18/src/node.cc#L4200) to a function that seemed to be loading built-in modules during the initialization phase of the Node main process.

    node::RegisterBuiltinModules();

I wanted to look into this a little bit more so I started snooping around the codebase to learn more.

Side note: I’ve changed the way I spell “code base” quite a bit in these blog posts. This is mostly because I have no idea whether it should be spelled “codebase” or “code base.” I did some snooping around and discovered [an interesting discussion](https://english.stackexchange.com/questions/237835/codebase-or-code-base) on StackExchange that seemed to signify that “codebase” was the less ambiguous way to spell it although “code base” is just as valid.

I eventaully found the definition of the `node:RegisterBuiltinModule` function [here](https://github.com/nodejs/node/blob/8938c4c22d720c33441ce95d801056532b99ec18/src/node.cc#L4613).

    void RegisterBuiltinModules() {
    #define V(modname) _register_##modname();
      NODE_BUILTIN_MODULES(V)
    #undef V
    }

This particular chunk of code is taking advantage of some special C++ syntax for defining macros. Essentially, the second line in the code snipped above is saying that every time there is an occurence of the string `V(modname)` it should be replaced with the string `_register_##modname()`. From what I can understand, this is basically creating an abbreviation of sorts so that `_register_modname` can be invoked repeatedly without having to type out the entire function name.

The next thing that I had to figure out was what exactly `NODE_BUILTIN_MODULES` was doing. I found the definition for this function call in [another source file](https://github.com/nodejs/node/blob/f3cd53751ba3f917a0996a8f38c991242a8fbc76/src/node_internals.h#L133) in the Node codebase.

    #define NODE_BUILTIN_MODULES(V) \
      NODE_BUILTIN_STANDARD_MODULES(V) \
      NODE_BUILTIN_OPENSSL_MODULES(V) \
      NODE_BUILTIN_ICU_MODULES(V)

So it look liks `NODE_BUILTIN_MODULES` is just a light wrapper function that invokes a few other functions that (I assume) load the different modules. The most interesting line above is obviously the `NODE_BUILTIN_STANDARD_MODULES` bit. `NODE_BUILTIN_STANDARD_MODULES` is another function macro that is responsible for loading in some of the built-in modules within Node. If you look at the [source file](https://github.com/nodejs/node/blob/f3cd53751ba3f917a0996a8f38c991242a8fbc76/src/node_internals.h#L101), you will see references to the `fs` and `os` and `buffer` modules.

At this point, I was a little bit confused. There are all these function macros floating around that _seem_ to be loading the built-in modules, but how exactly are they connected to the running system. How is that that I can run `require('fs')` in Node and everything works handy dandy. I noticed a comment above the definition of the `NODE_BUILTIN_STANDARD_MODULES` macro.

    // A list of built-in modules. In order to do module registration
    // in node::Init(), need to add built-in modules in the following list.
    // Then in node::RegisterBuiltinModules(), it calls modules' registration
    // function. This helps the built-in modules are loaded properly when
    // node is built as static library. No need to depends on the
    // __attribute__ ((constructor)) like mechanism in GCC.

So this comment was really helpful. It appears that these macros are actually the precursor to what happens in the registration phase. So what exactly is the registration phase looking like? I snooped around the code some more and found a [reference](https://github.com/nodejs/node/blob/f3cd53751ba3f917a0996a8f38c991242a8fbc76/src/node_internals.h#L150) to the `_register_##modname` function that I pointed out earlier.

    void _register_ ## modname() { \
      node_module_register(&_module); \
    }

So it looks like `_register_##modname` basically just invokes `node_module_register` with a reference to the module that needs to be registered. So what’s going on in the `node_module_register` function? Time for more snooping!

I eventually found the function definition of the `node_module_register` function [here](https://github.com/nodejs/node/blob/8938c4c22d720c33441ce95d801056532b99ec18/src/node.cc#L2145). It looks like this.

    extern "C" void node_module_register(void* m) {
      struct node_module* mp = reinterpret_cast<struct node_module*>(m);
    
      if (mp->nm_flags & NM_F_BUILTIN) {
        mp->nm_link = modlist_builtin;
        modlist_builtin = mp;
      } else if (mp->nm_flags & NM_F_INTERNAL) {
        mp->nm_link = modlist_internal;
        modlist_internal = mp;
      } else if (!node_is_initialized) {
        // "Linked" modules are included as part of the node project.
        // Like builtins they are registered *before* node::Init runs.
        mp->nm_flags = NM_F_LINKED;
        mp->nm_link = modlist_linked;
        modlist_linked = mp;
      } else {
        modpending = mp;
      }
    }

Oh boy! There is a lot going on here. The first line in this function is pretty standard if you’ve looked at a lot of C/C++ code. Since C++ is typed language, we are essentially casting the untyped pointer that is passed in the parameter as `m` to a pointer specifically typed as a pointer to a module in `mp`.

The module is referred to using a `node_module` struct. I decided to look aroud the codebase to see what properties were stored in the `node_module` struct. I figured that this would give me a sense of the different properties that are stored in the struct.

Side note: If you are unfamiliar with C/C++ but familiar with JavaScript, you can think of a struct like an object. It basically stores associations between a label and its value.

I found the definition for the `node_module` struct [here](https://github.com/nodejs/node/blob/12c8b4d15471cb6211b39c3a2ca5b10fa4b9f12b/src/node.h#L459). Unfortunately, there are no comments on the fields in the struct so it is difficult to figure out what is going on.

    struct node_module {
      int nm_version;
      unsigned int nm_flags;
      void* nm_dso_handle;
      const char* nm_filename;
      node::addon_register_func nm_register_func;
      node::addon_context_register_func nm_context_register_func;
      const char* nm_modname;
      void* nm_priv;
      struct node_module* nm_link;
    };

Some fields, like `nm_version` and `nm_filename`, are self-explantory but others are not. What is `nm_priv` and `nm_dso_handle`? I only have questions, never answers. Relevant to my current line of exploration, it looks like the module registeration functions assocaited with a module are stored in the struct itself. Handy!

I figured I would get back to looking at the `register_module_name` function to see if I could discern what some of the other fields in the struct were used for it. One of the patterns that I noticed in the function is snippets of code that looks like this.

    mp->nm_link = modlist_builtin;
    modlist_builtin = mp;

It looks like we are setting a field in the struct to a specific value (`modlist_builtin`) and then setting that value to the node module struct we just modified. From looking at the type definitions in the struct above, I know that `nm_link` is also a `node_module` struct so it appears that we are making a chain of module references here. I tried to validate my hypothesis by looking around to see where `modlist_builtin` was used in the code and I found [this snippet](https://github.com/nodejs/node/blob/8938c4c22d720c33441ce95d801056532b99ec18/src/node.cc#L2179).

    node_module* get_builtin_module(const char* name) {
      return FindModule(modlist_builtin, name, NM_F_BUILTIN);
    }

This definitely confirms my suspicion that we are creating al inked structure of `node_modules`. Then when we wnat to fetch a particalur module, we do a search through this linked structure to return it.

I was still wondering when the actual registration of these modules would happen. I tried to figure this out by doing a search for the string “nm\_register\_func” in the codebase. That’s the function name used to store the reference to the module registration function in the `node_module` struct above. I found a few invocations of this function name, but the [most illuminating one](https://github.com/nodejs/node/blob/8938c4c22d720c33441ce95d801056532b99ec18/src/node.cc#L2335) was in the `DLOpen` function in the Node library. `dlopen` is a general term for a function that is responsible for making function identifiers in the executable available to the program calling them. The “DL” in DLOpen stands for **D** ynamically **L** oaded because the modules are not loaded at the start of the program but are instead loaded when you run `require`.

So to wrap this up, the way I understood it is as follows.

- When the Node main process starts up, it runs through the built-in modules and creates a linked list like structure of modules that it stores in `modlist_builtin`.
- The `node_module` struct contains information about how to register a particular module.
- When a module is loaded via a require, the `nm_register_func` stored in the `node_module` struct is invoked.

Phew! That seems simple enough once you look back at it with hindsight. If I misunderstood any part of the code or if you have some clarifications on built-in module loading in Node, do [let me know](https://twitter.com/captainsafia).

