---
layout: post
title: 'Node module deep-dive: fs'
date: '2018-01-08T09:18:39-08:00'
tags:
- node-module-deep-dive
tumblr_url: https://blog.safia.rocks/post/169466425525/node-module-deep-dive-fs
---
Time for another Node module deep-dive!

I got some great feedback from folks that it would be interesting to dive into the C++ portions of the Node codebase in these annotated code reads. I agree. To be honest, I’ve avoided it up to this point mostly because of insecurities about my own knowledge of C++ and understanding about system-level software. But you know what, I am setting all that aside and diving into the C++ portions of the Node codebase because I am a brave and fearless developer.

I say this to clarify that don’t take anything I say as absolute fact and if you have insights into portions of the code I misunderstood, let me know [on Twitter](https://twitter.com/captainsafia).

Anyway, let’s get down to the fun stuff.

I’ve been thinking a lot about the `fs` module. The `fs` module is a part of the standard library in Node that allows the developer to interact with the filesystem. You can do things like read files, write files, and check the status of files. This is very handy if you are doing something like building a desktop application using JavaScript or interacting with files in a backend server.

One of the `fs` functions that I use the most is the `exists` function, which checks to see if a file exists. This function has actually be deprecated recently in favor of `fs.stat` or `fs.access`. So with this, I figured it would be interesting to dive in and see how `fs.access` works in Node. Just so we are all on the same page, here is how you might use `fs.access` in an application.

    > const fs = require('fs');
    undefined
    > fs.access('/etc/passwd', (error) => error ? console.log('This file does not exist.') : console.log('This file exists.'));
    undefined
    > This file exists.

Neat-o! So we can pass a filename and a callback that takes an error. If the `error` exists then we cannot access the file but if it does not exist then we can. So let’s head over to the [`fs` module in the codebase](https://github.com/nodejs/node/blob/8a86d9c1cf35fe4f892d483e3673083f5d8f42cf/lib/fs.js) to see what’s up. The code for the `fs.access` function looks like this.

    fs.access = function(path, mode, callback) {
      if (typeof mode === 'function') {
        callback = mode;
        mode = fs.F_OK;
      } else if (typeof callback !== 'function') {
        throw new errors.TypeError('ERR_INVALID_CALLBACK');
      }
    
      if (handleError((path = getPathFromURL(path)), callback))
        return;
    
      if (typeof path !== 'string' && !(path instanceof Buffer)) {
        throw new errors.TypeError('ERR_INVALID_ARG_TYPE', 'path',
                                   ['string', 'Buffer', 'URL']);
      }
    
      if (!nullCheck(path, callback))
        return;
    
      mode = mode | 0;
      var req = new FSReqWrap();
      req.oncomplete = makeCallback(callback);
      binding.access(pathModule.toNamespacedPath(path), mode, req);
    };

So like I mentioned before, it takes a path and a callback. It also takes a mode parameter which you can read more about [here](https://nodejs.org/api/fs.html#fs_fs_access_path_mode_callback). Most of the first few lines in the function are your standard validation and safety checks. I’ll avoid going into them here because I think they are pretty self-explanatory. I know it’s kind of annoying when people do the hand-wavey thing about code so if you have specific questions about these lines I’m overlooking, just ask me.

The code gets a little bit more interesting once we get to the last few lines in the function.

    var req = new FSReqWrap();
    req.oncomplete = makeCallback(callback);
    binding.access(pathModule.toNamespacedPath(path), mode, req);

I’ve never seen this `FSReqWrap` object before. I assume it’s some low-level API within the Node ecosystem for dealing with asynchronous requests. I tried to figure out where this Object is defined. The require statement for it looks like this.

    const { FSReqWrap } = binding;

So it looks like it is extracting the FSReqWrap object from `binding`. But what is `binding`?

    const binding = process.binding('fs');

Hm. So it seems to be the result of invoking `process.binding` with the `'fs'` parameter. I’ve seen these `process.binding` calls sprinkled across the codebase but have largely avoided digging into what they are. Not today! A quick Google resulted in [this StackOverflow question](https://stackoverflow.com/questions/24042861/nodejs-what-does-process-binding-mean), which confirmed my suspicion that `process.binding` was how C++-level code was exposed to the JavaScript portion of the codebase. So I dug around the Node codebase to try and find where the C/C++ code for `fs` resided. I discovered that there were actually two different C-level source files for `fs`, one associated [with Unix](https://github.com/nodejs/node/blob/8a86d9c1cf35fe4f892d483e3673083f5d8f42cf/deps/uv/src/unix/fs.c) and another associated [with Windows](https://github.com/nodejs/node/blob/8a86d9c1cf35fe4f892d483e3673083f5d8f42cf/deps/uv/src/win/fs.c).

So I tried to see if there was anything resembling a definition for the `access` function in the `fs` C source for Unix. The word `access` is referenced four times in the code.

Twice [here](https://github.com/nodejs/node/blob/8a86d9c1cf35fe4f892d483e3673083f5d8f42cf/deps/uv/src/unix/fs.c#L1075).

    #define X(type, action) \
      case UV_FS_ ## type: \
        r = action; \
        break;
    
        switch (req->fs_type) {
        X(ACCESS, access(req->path, req->flags));

And twice [here](https://github.com/nodejs/node/blob/8a86d9c1cf35fe4f892d483e3673083f5d8f42cf/deps/uv/src/unix/fs.c#L1137-L1146).

    int uv_fs_access(uv_loop_t* loop,
                     uv_fs_t* req,
                     const char* path,
                     int flags,
                     uv_fs_cb cb) {
      INIT(ACCESS);
      PATH;
      req->flags = flags;
      POST;
    }

Now you know what I meant about the whole “The C part of this code base makes me nervous” bit earlier.

I felt like the `uv_fs_access` was a lot easier to look into. I have no idea what is going on with that `X` function macro business and I don’t think I’m in a zen-like state of mind to figure it out.

OK! So the `uv_fs_access` function seems to be passing the `ACCESS` constant to the `INIT` function macro which looks a little bit like this.

    #define INIT(subtype) \
      do { \
        if (req == NULL) \
          return -EINVAL; \
        req->type = UV_FS; \
        if (cb != NULL) \
          uv__req_init(loop, req, UV_FS); \
        req->fs_type = UV_FS_ ## subtype; \
        req->result = 0; \
        req->ptr = NULL; \
        req->loop = loop; \
        req->path = NULL; \
        req->new_path = NULL; \
        req->cb = cb; \
      } \
      while (0)

So the `INIT` function macro seems to be initializing the fields in some `req` structure. From looking at the type declarations on the function parameters of functions that took `req` in as an argument, I figured that req was a pointer to a `uv_fs_t` Object. I found [some documentation](https://github.com/nodejs/node/blob/5ebfaa88917ebcef1dd69e31e40014ce237c60e2/deps/uv/docs/src/fs.rst) that rather tersely stated that `uv_fs_t` was a file system request type. I guess that’s all I need to know about it!

Side note: Why is this code written in a `do {} while (0)` instead of just a sequence of function calls. Does anyone know why this might be? Late addition: I did some Googling and found a [StackOverflow post](https://stackoverflow.com/questions/9495962/why-use-do-while-0-in-macro-definition) that answered this question.

OK. So once this filesystem request object has been initialized, the `access` function invokes the `PATH` macro which does the following.

    #define PATH \
      do { \
        assert(path != NULL); \
        if (cb == NULL) { \
          req->path = path; \
        } else { \
          req->path = uv__strdup(path); \
          if (req->path == NULL) { \
            uv__req_unregister(loop, req); \
            return -ENOMEM; \
          } \
        } \
      } \
      while (0)

Hm. So this seems to be checking to see if the path that the file system request is associated with is a valid path. If the path is invalid, it seems to unregister the loop associated with the request. I don’t understand a lot of the details of this code, but my hunch is that it does validation on the filesystem request being made.

The next invocation that `uv_fs_access` calls is to the `POST` macro which has the following code associated with it.

    #define POST \
      do { \
        if (cb != NULL) { \
          uv__work_submit(loop, &req->work_req, uv__fs_work, uv__fs_done); \
          return 0; \
        } \
        else { \
          uv__fs_work(&req->work_req); \
          return req->result; \
        } \
      } \
      while (0)

So it looks like the `POST` macros actually invokes the action loop associated with the filesystem request and then executes the appropriate callbacks.

At this point, I was a little bit lost. I happened to be attending [StarCon](https://starcon.io) with fellow code-reading enthusiast [Julia Evans](https://twitter.com/b0rk). We sat together and grokked through some of the code in the `uv__fs_work` function which looks something like this.

    static void uv__fs_work(struct uv__work* w) {
      int retry_on_eintr;
      uv_fs_t* req;
      ssize_t r;
    
      req = container_of(w, uv_fs_t, work_req);
      retry_on_eintr = !(req->fs_type == UV_FS_CLOSE);
    
      do {
        errno = 0;
    
    #define X(type, action) \
      case UV_FS_ ## type: \
        r = action; \
        break;
    
        switch (req->fs_type) {
        X(ACCESS, access(req->path, req->flags));
        X(CHMOD, chmod(req->path, req->mode));
        X(CHOWN, chown(req->path, req->uid, req->gid));
        X(CLOSE, close(req->file));
        X(COPYFILE, uv__fs_copyfile(req));
        X(FCHMOD, fchmod(req->file, req->mode));
        X(FCHOWN, fchown(req->file, req->uid, req->gid));
        X(FDATASYNC, uv__fs_fdatasync(req));
        X(FSTAT, uv__fs_fstat(req->file, &req->statbuf));
        X(FSYNC, uv__fs_fsync(req));
        X(FTRUNCATE, ftruncate(req->file, req->off));
        X(FUTIME, uv__fs_futime(req));
        X(LSTAT, uv__fs_lstat(req->path, &req->statbuf));
        X(LINK, link(req->path, req->new_path));
        X(MKDIR, mkdir(req->path, req->mode));
        X(MKDTEMP, uv__fs_mkdtemp(req));
        X(OPEN, uv__fs_open(req));
        X(READ, uv__fs_buf_iter(req, uv__fs_read));
        X(SCANDIR, uv__fs_scandir(req));
        X(READLINK, uv__fs_readlink(req));
        X(REALPATH, uv__fs_realpath(req));
        X(RENAME, rename(req->path, req->new_path));
        X(RMDIR, rmdir(req->path));
        X(SENDFILE, uv__fs_sendfile(req));
        X(STAT, uv__fs_stat(req->path, &req->statbuf));
        X(SYMLINK, symlink(req->path, req->new_path));
        X(UNLINK, unlink(req->path));
        X(UTIME, uv__fs_utime(req));
        X(WRITE, uv__fs_buf_iter(req, uv__fs_write));
        default: abort();
        }
    #undef X
      } while (r == -1 && errno == EINTR && retry_on_eintr);
    
      if (r == -1)
        req->result = -errno;
      else
        req->result = r;
    
      if (r == 0 && (req->fs_type == UV_FS_STAT ||
                     req->fs_type == UV_FS_FSTAT ||
                     req->fs_type == UV_FS_LSTAT)) {
        req->ptr = &req->statbuf;
      }
    }

OK! I know this looks a little bit scary. Trust me, it scared me when I first looked at it too. One of the things that Julia and I realized was that this bit of the code.

    #define X(type, action) \
      case UV_FS_ ## type: \
        r = action; \
        break;
    
        switch (req->fs_type) {
        X(ACCESS, access(req->path, req->flags));
        X(CHMOD, chmod(req->path, req->mode));
        X(CHOWN, chown(req->path, req->uid, req->gid));
        X(CLOSE, close(req->file));
        X(COPYFILE, uv__fs_copyfile(req));
        X(FCHMOD, fchmod(req->file, req->mode));
        X(FCHOWN, fchown(req->file, req->uid, req->gid));
        X(FDATASYNC, uv__fs_fdatasync(req));
        X(FSTAT, uv__fs_fstat(req->file, &req->statbuf));
        X(FSYNC, uv__fs_fsync(req));
        X(FTRUNCATE, ftruncate(req->file, req->off));
        X(FUTIME, uv__fs_futime(req));
        X(LSTAT, uv__fs_lstat(req->path, &req->statbuf));
        X(LINK, link(req->path, req->new_path));
        X(MKDIR, mkdir(req->path, req->mode));
        X(MKDTEMP, uv__fs_mkdtemp(req));
        X(OPEN, uv__fs_open(req));
        X(READ, uv__fs_buf_iter(req, uv__fs_read));
        X(SCANDIR, uv__fs_scandir(req));
        X(READLINK, uv__fs_readlink(req));
        X(REALPATH, uv__fs_realpath(req));
        X(RENAME, rename(req->path, req->new_path));
        X(RMDIR, rmdir(req->path));
        X(SENDFILE, uv__fs_sendfile(req));
        X(STAT, uv__fs_stat(req->path, &req->statbuf));
        X(SYMLINK, symlink(req->path, req->new_path));
        X(UNLINK, unlink(req->path));
        X(UTIME, uv__fs_utime(req));
        X(WRITE, uv__fs_buf_iter(req, uv__fs_write));
        default: abort();
        }
    #undef X

is actually a giant switch-statement. The enigmatic looking `X` macro is actually syntactic sugar for the syntax for the case statement that looks like this.

      case UV_FS_ ## type: \
        r = action; \
        break;

So, for example, this macro-function call, `X(ACCESS, access(req->path, req->flags))`, actually corresponds with the following expanded case statement.

    case UV_FS_ACCESS:
        r = access(req->path, req->flags)
        break;

So our case statement essentially ends up calling the `access` function and setting its response to `r`. What is `access`? Julia helped me realized that `access` was a part of the system’s library defined in [unistd.h](http://pubs.opengroup.org/onlinepubs/7908799/xsh/unistd.h.html). So this is where Node actually interacts with system-specific APIs.

Once it has stored a result in `r`, the function executes the following bit of code.

    if (r == -1)
      req->result = -errno;
    else
      req->result = r;
    
    if (r == 0 && (req->fs_type == UV_FS_STAT ||
                   req->fs_type == UV_FS_FSTAT ||
                   req->fs_type == UV_FS_LSTAT)) {
      req->ptr = &req->statbuf;
    }

So what this is basically doing is checking to see if the result that was received from invoking the system-specific APIS was valid and stores it back into that filesystem request object that I mentioned earlier. Interesting!

And that’s that for this code read. I had a blast reading through the C portions of the codebase and Julia’s help was especially handy. If you have any questions or want to provide clarifications on things I might have misinterpreted, [let me know](https://twitter.com/captainsafia). Until next time!

