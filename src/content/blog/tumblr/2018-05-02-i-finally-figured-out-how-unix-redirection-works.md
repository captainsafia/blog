---
layout: post
title: I finally figured out how Unix redirection works under the hood
date: '2018-05-02T18:48:51-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173528344275/i-finally-figured-out-how-unix-redirection-works
---
In the last blog post, I decided to look into Unix redirection. Towards the end of it, I ended up being perplexed about an aspect of the stack trace and stated that I would look into it later.

Well, I lied.

Today, I’ll be digging into the same concept using a different stack trace. As I mentioned in previous blog posts, since I started working full-time, I’ve been writing my thrice-weekly blog posts on my commute to work. Usually, I’ll run `dtruss` on my Mac at home, copy the stack trace over, and then analyze it there. Recently, I was looking through some Google Cloud emails I was getting and realized that I had a one-year free trial of Google Cloud hanging around in my inbox. I used it to set up a Debian virtual machine that I could SSH to and use for these blog posts. So from now on, the stack traces I’m looking through are run on a Debian machine.

Sidebar: A lot of pedants on Hacker News like to point out that I’ve been reading stack traces on Mac, not a proper \*nix system. I see where they’re coming from, but I try to keep these blog posts to be as operating-system specific as possible. My analysis usually refers to system calls that are used across the \*nix ecosystem for similar purposes. All this is to say, stop being pedantic and let a girl live. If you’re genuinely concerned about what I’m writing, invest your own time in writing your own blog posts the way you want them written. Trust me; you’ll be happier that way.

Anyway, angry sidebar aside, let’s get back to the heart of the story. Before you read further, I’d recommend reading [the last blog post](https://blog.safia.rocks/2018-04-30-reveling-in-redirects-exploring-unix-inputoutput/). It contains some explanations of the `fork` and `exec` system calls and how the way processes are executed enables redirection.

Did you read it? OK. Onward we go!

So, like last time, I ran `strace` on a sample command to get the system calls invoked while it ran.

    execve("/bin/echo", ["echo", "New addition."], [/* 16 vars */]) = 0
    brk(NULL) = 0x55c3a89fa000
    access("/etc/ld.so.nohwcap", F_OK) = -1 ENOENT (No such file or directory)
    mmap(NULL, 12288, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x7f3a4faf9000
    access("/etc/ld.so.preload", R_OK) = -1 ENOENT (No such file or directory)
    open("/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3
    fstat(3, {st_mode=S_IFREG|0644, st_size=13435, ...}) = 0
    mmap(NULL, 13435, PROT_READ, MAP_PRIVATE, 3, 0) = 0x7f3a4faf5000
    close(3) = 0
    access("/etc/ld.so.nohwcap", F_OK) = -1 ENOENT (No such file or directory)
    open("/lib/x86_64-linux-gnu/libc.so.6", O_RDONLY|O_CLOEXEC) = 3
    read(3, "\177ELF\2\1\1\3\0\0\0\0\0\0\0\0\3\0>\0\1\0\0\0\0\4\2\0\0\0\0\0"..., 832) = 832
    fstat(3, {st_mode=S_IFREG|0755, st_size=1689360, ...}) = 0
    mmap(NULL, 3795296, PROT_READ|PROT_EXEC, MAP_PRIVATE|MAP_DENYWRITE, 3, 0) = 0x7f3a4f53a000
    mprotect(0x7f3a4f6cf000, 2097152, PROT_NONE) = 0
    mmap(0x7f3a4f8cf000, 24576, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_FIXED|MAP_DENYWRITE, 3, 0x195000) = 0x7f3a4f8cf000
    mmap(0x7f3a4f8d5000, 14688, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_FIXED|MAP_ANONYMOUS, -1, 0) = 0x7f3a4f8d5000
    close(3) = 0
    mmap(NULL, 8192, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x7f3a4faf3000
    arch_prctl(ARCH_SET_FS, 0x7f3a4faf3700) = 0
    mprotect(0x7f3a4f8cf000, 16384, PROT_READ) = 0
    mprotect(0x55c3a7464000, 4096, PROT_READ) = 0
    mprotect(0x7f3a4fafc000, 4096, PROT_READ) = 0
    munmap(0x7f3a4faf5000, 13435) = 0
    brk(NULL) = 0x55c3a89fa000
    brk(0x55c3a8a1b000) = 0x55c3a8a1b000
    open("/usr/lib/locale/locale-archive", O_RDONLY|O_CLOEXEC) = 3
    fstat(3, {st_mode=S_IFREG|0644, st_size=1679776, ...}) = 0
    mmap(NULL, 1679776, PROT_READ, MAP_PRIVATE, 3, 0) = 0x7f3a4f958000
    close(3) = 0
    fstat(1, {st_mode=S_IFREG|0644, st_size=0, ...}) = 0
    write(1, "New addition.\n", 14) = 14
    close(1) = 0
    close(2) = 0
    exit_group(0) = ?

To decode this stack trace a little bit, I started by figuring out what happens from bottom to top.

The last system call, `exit_group`, is responsible for “closing all threads in the process.” I wondered what this would mean in the context of the command currently being executed. In particular, I figured that if `exit_group` is responsible for closing all threads in a process then there should be some invocations to `clone` in the stack trace (`clone` creates a new thread). Eventually, I figured out the answer to why `exit_group` was being called although it seemed that no threads were created. According to [this](https://stackoverflow.com/questions/46903180/syscall-implementation-of-exit), in recent versions of Linux, the call to the `exit` function implicitly calls `exit_group` under the hood. It seems that this was done so that whenever you `exit`ed a process, it closed out the threads to instead of potentially leaving them open.

The two commands preceding it were pretty self-explanatory. `close(1)` and `close(2)` are responsible closing the file descriptors associated with the parameters passed. As mentioned in my last blog post, it looks like it is closing the file descriptors associated with standard input and output in that process.

The function call immediately preceding this actually prints out the string we are echoing into the file referenced by file descriptor 1. At this point, I’m pretty sure that somewhere in the stack trace I should see a function call to open `file.txt` but I don’t see it. At this point, I’m suspecting that `strace` isn’t calling the fork call that occurs before file output. I tried to run `strace` with the `-f` flag to follow the forks but didn’t have any luck.

Eventually, I figured out what was going on. Similar to last time, to capture the system calls associated with the redirection, I had to run `strace` on the shell process that I was executing the commands in. Once I did this, I got the output that I expected.

    open("file.txt", O_WRONLY|O_CREAT|O_TRUNC, 0666) = 3
    fcntl(1, F_GETFD) = 0
    fcntl(1, F_DUPFD, 10) = 10
    fcntl(1, F_GETFD) = 0
    fcntl(10, F_SETFD, FD_CLOEXEC) = 0
    dup2(3, 1) = 1
    close(3) = 0
    write(1, "New addition.\n", 14) = 14
    dup2(10, 1) = 1
    fcntl(10, F_GETFD) = 0x1 (flags FD_CLOEXEC)
    close(10)  

That’s more like it! In this stack trace, I can see the `open` system call that opens the `file.txt` we are writing too. This seems to be the stack trace I actually want to read.

I’ll go through this one from top to bottom. The first line in the stack trace opens the `file.txt` file for writing. The return code, `3`, tells us the file descriptor associated with this open file.

The next four system calls all invoke the `fcntl` command which manipulates file descriptors based on its second parameter. The first call to `fnctl` gets the flags associated with the standard output file descriptor. The second function duplicates the file referenced by file descriptor 1 into file descriptor 10. The next two system calls are responsible for setting the flags on the new file descriptor to match the old one. So essentially, all this code is doing is creating a copy of the file descriptor associated with standard output.

The next system call, `dup2`, is one I have not encountered before. Looking at the documentation, it looks like this function copies the file descriptor 3 into the file descriptor 1. This effectively remaps standard output to `file.txt`.

After that, we write the text we want directly to file descriptor 1, which is also `file.txt`.

The last few function calls undo the remapping of the standard output file descriptor and close out any stale file descriptors.

This makes much more sense! Essentially, we make a backup copy of the file descriptor typically associated with standard output and store it in a new file descriptor. Then we map the file descriptor associated with standard output to our file. Then after writing, we undo the re-mappings we made.

I guess I had not been properly calling the `strace` command earlier which is why I was getting all that funky output. Once I figured out the way to properly call `strace` in order to process redirection correctly, I got a much clearer stack trace!

Huzzah!

