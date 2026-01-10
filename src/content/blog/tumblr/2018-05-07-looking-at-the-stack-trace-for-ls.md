---
layout: post
title: Looking at the stack trace for `ls`
date: '2018-05-07T07:58:01-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173669696575/looking-at-the-stack-trace-for-ls
---
You know what Mondays mean. A new blog post!

I’m trying something new this week. Instead of writing my thrice-weekly blog posts on my commute to and from work, I’ll write all of them on a single day over the weekend.

Today, I’m going to be looking at a command that I previously looked at the codebase for, the `ls` command. To be honest, it feels like that happened so long ago I don’t even remember it. In any case, I hopped over to my Debian VM instance on Google Cloud and ran `strace` on the `ls` command in my home directory.

It starts off by running the `open` system call on the current working directory. It’s passing quite a few flags to the call. Some I already knew about and some I didn’t. Nonetheless, here’s a breakdown of what all those flags are doing.

1. `O_RDONLY`: Open the file for reading only. No file modifications allowed!
2. `O_NONBLOCK`: Return from the `open` call without any delay.
3. `O_DIRECTORY`: Open a directory with the intent of examining its contents.
4. `O_CLOEXEC`: Automatically close the file descriptor when the current process being `exec`ed returns.

    [pid 13721] open(".", O_RDONLY|O_NONBLOCK|O_DIRECTORY|O_CLOEXEC) = 3
    [pid 13721] fstat(3, {st_mode=S_IFDIR|0755, st_size=4096, ...}) = 0

The next system call invoked is the `getdents` system call which, according to [the docs](https://linux.die.net/man/2/getdents), returns the contents of a directory.

    [pid 13721] getdents(3, /* 13 entries */, 32768) = 400

The next couple of lines are invocations of the `lstat` function on each of the contents of the directory. This is used by `ls` to determine the size of the file and the owner and so on. This is the kind of information that you would see when you run `ls` with the `-l` flag.

    [pid 13721] lstat("test-4.txt", {st_mode=S_IFREG|0644, st_size=13, ...}) = 0

The last two calls in the stack trace did mystify me a bit. The function makes _another_ call to the `getdents` system call. Why is it doing this? I tried to spot the differences between the two system calls. In the first one, the second parameter points to a list of 13 directory entry structs and the system call returns 400. In the second call listed below, the second parameter points to a list of 0 directory entry structs and returns 0. I figured that perhaps the invocation was made twice because there was some for-loop iterating until the `getdents` function returned 0.

    [pid 13721] getdents(3, /* 0 entries */, 32768) = 0
    [pid 13721] close(3)

The last line in the stack trace closes the file descriptor associated with the current directory that we are reading.

And with that, I close off this blog post! I know this blog post is short, but that’s because I’m preparing you for what’s coming later this week. It’s gonna be a doozy…

