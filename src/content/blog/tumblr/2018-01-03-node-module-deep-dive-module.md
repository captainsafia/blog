---
layout: post
title: 'Node module deep-dive: module'
date: '2018-01-03T09:31:25-08:00'
tags:
- node-module-deep-dive
tumblr_url: https://blog.safia.rocks/post/169267758290/node-module-deep-dive-module
---
Oh, hi there!

Long time, no see.

I took a little break from this blog post series to enjoy the holidays and [to code up a new version of Zarf](https://blog.tanmulabs.com/post/169235140204/introducing-zarf-v20). But I’m back and ready to roll with this blog post series.

I wanna start by looking at the `module` module (try saying that three times fast!). The [modules page](https://nodejs.org/api/modules.html) of the NodeJS docs contains a plethora of information about the module system in Node. Before diving into the code base for `module`, I did a quick read through it. I’ll avoid summarizing the content of that documentation page here as I’m focusing on the code but it might help if you skimmed through it before reading the rest of this blog post.

As usual, I started my code read by reading the last few lines in the [`module.js`](https://github.com/nodejs/node/blob/5dbd77eb83244fbad731f660ebe5d9829a523821/lib/module.js) file.

    Module._initPaths();
    
    // backwards compatibility
    Module.Module = Module;

So it looks like there is a variable mapping at the bottom with a comment noting that it is for “backwards compatibility.” I dug a little further into this by looking through the commit history on this file. It looks like [the change emerged in early-2011](https://github.com/nodejs/node/commit/5a49f96505e48d2a1aa3a21233976f41fe1257ce) (back when Node was but a wee little baby) and was part of some sort of refactor of the CommonJS module system. The refactor involved moving some files around so the remapping actually predates the early 2011 date. I’m starting to go down a bit of an archaeological wormhole so I’ll stop here and get back to the code.

The `_initPaths` function is invoked at the start of the file. If I had to do my best to guess, I would say that it would be responsible for initialized some paths — hehehe. The first few lines of the `__initPaths` function are pretty standard and a common occurrence in the JavaScript side of the code base from what I’ve been reading. The logic is simple: if we’re on Windows, do this; otherwise, do that. In this particular case, the conditional logic takes care of setting up the variable for the directory of the user’s home folder.

    Module._initPaths = function() {
      const isWindows = process.platform === 'win32';
    
      var homeDir;
      if (isWindows) {
        homeDir = process.env.USERPROFILE;
      } else {
        homeDir = process.env.HOME;
      }

The next bit of code also utilizes a similar conditional logic to determine the location of the Node.js installation on the machine in question.

      // $PREFIX/lib/node, where $PREFIX is the root of the Node.js installation.
      var prefixDir;
      // process.execPath is $PREFIX/bin/node except on Windows where it is
      // $PREFIX\node.exe.
      if (isWindows) {
        prefixDir = path.resolve(process.execPath, '..');
      } else {
        prefixDir = path.resolve(process.execPath, '..', '..');
      }

The function then creates a `paths` array where it stores the potential locations of Node modules at both the Node.js installation and the user’s home directory.

The next bit of code gets the value of the `NODE_PATH` environment variable. I was a little bit curious about this environment variable name since i hadn’t come across it before. A more thorough re-reading of the [modules documentation](https://nodejs.org/api/modules.html#modules_loading_from_the_global_folders) revealed that this is a little bit of a “legacy” variable from the days when there wasn’t a convention on how modules are loaded in Node.

Side note: Is anyone else a little peeved that the accessor is written in `process.env['NODE_PATH']` form and not `process.env.NODE_PATH` form? No? Just me? OK.

Anyways. The code following this is a bit interesting. `nodePath` is a semi-colon (or colon, if you’re on Windows) separated string of paths. The next bit of code splits the string on either the colon or the semicolon, iterates through each of the elements (which are paths) in that list and checks to see if they are a truthy value, and then adds them to the existing `paths` list that we have going. So now our paths list contains a collection of modules at the Node.js installation, our home directory, and the directories referenced in the `NODE_PATH` environment variable. Sweet-o!

      var nodePath = process.env['NODE_PATH'];
      if (nodePath) {
        paths = nodePath.split(path.delimiter).filter(function(path) {
          return !!path;
        }).concat(paths);
      }

Finally, the function sets the value of `Module.globalPaths` to a copy of the `paths` list that we just made.

The next function that I thought would be interesting to look at is the `require` function.

    Module.prototype.require = function(path) {
      assert(path, 'missing path');
      assert(typeof path === 'string', 'path must be a string');
      return Module._load(path, this, /* isMain */ false);
    };

So it looks like require does some basic assertions to confirm the validity of the `path` that is passed and then invokes the `_load` function. The first bit of the `_load` function was pretty interesting.

    if (isMain && experimentalModules) {
      (async () => {
        // loader setup
        if (!ESMLoader) {
          ESMLoader = new Loader();
          const userLoader = process.binding('config').userLoader;
          if (userLoader) {
            const hooks = await ESMLoader.import(userLoader);
            ESMLoader = new Loader();
            ESMLoader.hook(hooks);
          }
        }
        Loader.registerImportDynamicallyCallback(ESMLoader);
        await ESMLoader.import(getURLFromFilePath(request).pathname);
      })()

So it looks like we are checking to see if the `isMain` variable and the `experimentalModules` variables are true. `isMain` refers to (I assume) whether or not the require is coming from the main module and `experimentaModules` refers to whether or not Node is configured to support [ES Modules](https://nodejs.org/api/esm.html). It looks like if this is the case, the function invokes the ES module loader. I’ll look a little bit more into the ES module loader in another blog post so I’ll forgo diving into it for now. Instead, I looked through the rest of the `_load` function.

So it looks like the first thing `_load` does is fetch the filename associated with the module that we are trying to import.

    var filename = Module._resolveFilename(request, parent, isMain);

It does this by calling `_resolveFilename` which does a search for a file with that module name based on the following precedence.

    // require("a.<ext>")
    // -> a.<ext>
    //
    // require("a")
    // -> a
    // -> a.<ext>
    // -> a/index.<ext>

If you read the module documentation linked to above, you’ll recall that Node caches the modules that it requires. This makes the next couple of lines in the code easy to understand.

    var cachedModule = Module._cache[filename];
    if (cachedModule) {
      updateChildren(parent, cachedModule, true);
      return cachedModule.exports;
    }

So basically, once it has the filename associated with the module it checks to see if that module has already been loaded and is in the cache. If it is, it calls the `updateChildren` function which (I assume) updates some internal data structure to store the fact that the cached module has now been required by a new module. It then returns the exports that are exported by that module.

The next bit of code checks to see if the module requested is a NativeModule. If so, it passes the require request through to the `require` function in the Native Module loader. I’ll have to read the code for that at some other point in time.

Side note: Now would be a good time for me to [plug my Twitter](https://twitter.com/captainsafia) as a good place to get updates on new blog posts in this series. :)

Finally, if the module has not already been required and it is not a Native module the function invokes the `Module` constructor to create a new Module object for the particular module we are trying to load and stores it in the cache.

    var module = new Module(filename, parent);
    ...
    Module._cache[filename] = module;

Next it invokes the `tryModuleLoad` function on `module`. The `tryModuleLoad` function is basically a little try-catch wrapper around the `load` prototype function in the `Module` object. What the `load` function does is check the file extension on the `filename` of the module and then pass it on to a different loader. So for example, filenames that end in `.js` are handled by one loader and filenames that end in `.json` are handled by another. From a quick look through, it looks like we can import files ending with `.js`, `.json`m `.node`, and `.mjs` (the file extension for the new ES module system). That makes sense. Each of the extension loaders is ultimately responsible for populating the `exports` field in the `module` object which is returned as a result of the require.

    return module.exports;

I’ll stop my code read through here to keep the blogpost from running long but essentially, the module loader is responsible for managing caching and lookups of modules (of potentially different types) on our system. If you have any questions or comments about the above, feel free to [reach out to me on Twitter](https://twitter.com/captainsafia).

