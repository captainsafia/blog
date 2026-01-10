---
layout: post
title: Peeking into `pwd`
date: '2018-04-25T20:41:29-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173309576925/peeking-into-pwd
---
Oh my gosh. Can I really keep up with this? I’m gonna be honest with you, fair reader, working a full-time job and maintaining this blog is proving to be quite the challenge.

But alas, I shall persist.

I figured I might continue the trend that I started in my last blog post and dive into the layers beneath some common command line tools. Today, I’m interested in one that is extremely common: `pwd`.

    $ pwd
    /Users/captainsafia

As I did in the last blog post, I’ll start diving into it by using the `dtrace` tool that comes with macOS. It’s essentially a command line utility that allows you to analyze a trace of the system calls made during the execution of a program. Here’s what the `dtrace` program outputs when I run `pwd` on my home directory.

    sudo dtruss /tmp/pwd
    dtrace: system integrity protection is on, some features will not be available
    
    SYSCALL(args) = return
    /Users/captainsafia
    open("/dev/dtracehelper\0", 0x2, 0xFFFFFFFFE2CBAB20) = 3 0
    ioctl(0x3, 0x80086804, 0x7FFEE2CBAA80) = 0 0
    close(0x3) = 0 0
    access("/AppleInternal/XBS/.isChrooted\0", 0x0, 0x0) = -1 Err#2
    thread_selfid(0x0, 0x0, 0x0) = 6082815 0
    bsdthread_register(0x7FFF56790BEC, 0x7FFF56790BDC, 0x2000) = 1073742047 0
    issetugid(0x0, 0x0, 0x0) = 0 0
    mprotect(0x10CF4D000, 0x1000, 0x0) = 0 0
    mprotect(0x10CF52000, 0x1000, 0x0) = 0 0
    mprotect(0x10CF53000, 0x1000, 0x0) = 0 0
    mprotect(0x10CF58000, 0x1000, 0x0) = 0 0
    mprotect(0x10CF4B000, 0x88, 0x1) = 0 0
    mprotect(0x10CF59000, 0x1000, 0x1) = 0 0
    mprotect(0x10CF4B000, 0x88, 0x3) = 0 0
    mprotect(0x10CF4B000, 0x88, 0x1) = 0 0
    getpid(0x0, 0x0, 0x0) = 8043 0
    stat64("/AppleInternal/XBS/.isChrooted\0", 0x7FFEE2CBA158, 0x0) = -1 Err#2
    stat64("/AppleInternal\0", 0x7FFEE2CBA1F0, 0x0) = -1 Err#2
    csops(0x1F6B, 0x7, 0x7FFEE2CB9C90) = 0 0
    dtrace: error on enabled probe ID 2190 (ID 557: syscall::sysctl:return): invalid kernel access in action #10 at DIF offset 28
    csops(0x1F6B, 0x7, 0x7FFEE2CB9580) = 0 0
    stat64("/Users/captainsafia\0", 0x7FFEE2CBB8B0, 0x0) = 0 0
    stat64(".\0", 0x7FFEE2CBB940, 0x0) = 0 0
    getrlimit(0x1008, 0x7FFEE2CBB6D0, 0x0) = 0 0
    fstat64(0x1, 0x7FFEE2CBB6E8, 0x0) = 0 0
    ioctl(0x1, 0x4004667A, 0x7FFEE2CBB734) = 0 0
    dtrace: error on enabled probe ID 2165 (ID 947: syscall::write_nocancel:return): invalid kernel access in action #12 at DIF offset 68

Oh boy! There’s quite a lot going on here. But we can rule most of it out since it was explored in [the last blog post](https://blog.safia.rocks/2018-04-23-unraveling-rm-what-happens-when-you-run-it/). There were a few lines in the stack trace that attracted my interest. The first line was this one.

`getrlimit(0x1008, 0x7FFEE2CBB6D0, 0x0) = 0 0`

What does `getrlimit` do? I did some digging on the Internet and [discovered that](http://man7.org/linux/man-pages/man2/getrlimit.2.html) is responsible for getting resource limits on a resource. In this case, the first parameter (`0x1008`) is a reference to the resource we are trying to modify limits on. I wondered what resource this number was referencing. It would go a long way towards helping me figure out why this function was invoked in this bit of code. I ended up finding something useful in the Python documentation. Python has a built-in `resource` module that can be used to interface with resources on the system. There was this interesting quote in the documentation.

> The Unix man page for getrlimit(2) lists the available resources. Note that not all systems use the same symbol or same value to denote the same resource. This module does not attempt to mask platform differences — symbols not defined for a platform will not be available from this module on that platform.

So it looks like each operating system has different values that it uses for that first parameter. This makes it difficult to figure out what exactly `0x1008` means in the context of macOS since a lot of the documentation is around Unix. That being said, the documentation did give me a pretty good idea of what the resource might reference. A resource is something like the number of bytes available to a process in its heap or the maximum amount of CPU time that the process can use.

Another thing I was curious about was this `stat64` system call.

    stat64(".\0", 0x7FFEE2CBB940, 0x0) = 0 0

I think this line is the most significant one concerning analyzing how `pwd` works because the parameter passed to it is the “.” parameter, which is generally used as a reference to the current working directory.

Sidebar: The `\0` is the null terminator and signifies that the string has ended.

As mentioned in the previous blog post, most of the other system calls are related to the actual operations of the `dtrace` tool and don’t relate to the functionality of `pwd`.

That was an interesting exploration! The most fascinating bit was some of the snooping that I did around resource limits in the operating system. It exposed me to yet another way that operating systems are different at the low-level: the use different reference codes for resources. Of course, this small difference makes it difficult to build cross-platform applications using low-level programming langauges.

Until next time!

