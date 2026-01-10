---
layout: post
title: What happens when you run `cp` on the command line?
date: '2018-04-27T17:13:35-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173365993220/what-happens-when-you-run-cp-on-the-command
---
It’s time for another edition of whatever the heck this is! After the deep dives I took into the Git code base, I no longer have the energy to craft up interesting names for these code anthropology moments.

I was considering diving into how the `cp` command works in this blog post. If you’re a long-time reader, you might know that I generally do my code reads on my Mac. Since I started my full-time job on Monday, I’ve been writing these blog posts on a Chromebook on the way to and from work (amongst a variety of other things I do on my commute like stare at traffic and acknowledge how wonderful it is that will hopefully never have to operate a motor vehicle). Since I’m working on my Chromebook, I’ll usually run the `dtruss` command on my Mac before I head out the door, copy and paste the output of the stack trace onto cloud-enabled text editor, then read through and research parts of the stack trace on my way to work.

Sidebar: I think at some point I’m going to irritate somebody on this rideshare with all this clackity-clacking!

This is all to say that these blog posts might be shorter and jumpier than usual due to the new constraints that I am writing under. Let’s call it eXtreme Writing. Heh. Get it? Like eXtreme Programming? OK. I’ll keep my day job.

With all that said, it’s time to get to the real purpose of this post. What happens when you run the `cp` command? The `cp` command is often used to make copies of directories and files. But what is going on under the hood?

    $ sudo dtruss cp file.txt file-2.txt
    
    SYSCALL(args) = return
    open("/dev/dtracehelper\0", 0x2, 0xFFFFFFFFE1B5FB00) = 3 0
    ioctl(0x3, 0x80086804, 0x7FFEE1B5FA60) = 0 0
    close(0x3) = 0 0
    access("/AppleInternal/XBS/.isChrooted\0", 0x0, 0x0) = -1 Err#2
    thread_selfid(0x0, 0x0, 0x0) = 6158775 0
    bsdthread_register(0x7FFF56790BEC, 0x7FFF56790BDC, 0x2000) = 1073742047 0
    issetugid(0x0, 0x0, 0x0) = 0 0
    mprotect(0x10E1AB000, 0x1000, 0x0) = 0 0
    mprotect(0x10E1B0000, 0x1000, 0x0) = 0 0
    mprotect(0x10E1B1000, 0x1000, 0x0) = 0 0
    mprotect(0x10E1B6000, 0x1000, 0x0) = 0 0
    mprotect(0x10E1A9000, 0x88, 0x1) = 0 0
    mprotect(0x10E1B7000, 0x1000, 0x1) = 0 0
    mprotect(0x10E1A9000, 0x88, 0x3) = 0 0
    mprotect(0x10E1A9000, 0x88, 0x1) = 0 0
    getpid(0x0, 0x0, 0x0) = 8855 0
    stat64("/AppleInternal/XBS/.isChrooted\0", 0x7FFEE1B5F138, 0x0) = -1 Err#2
    stat64("/AppleInternal\0", 0x7FFEE1B5F1D0, 0x0) = -1 Err#2
    csops(0x2297, 0x7, 0x7FFEE1B5EC70) = 0 0
    dtrace: error on enabled probe ID 2190 (ID 557: syscall::sysctl:return): invalid kernel access in action #10 at DIF offset 28
    csops(0x2297, 0x7, 0x7FFEE1B5E560) = 0 0
    sigaction(0x1D, 0x7FFEE1B602E8, 0x7FFEE1B60310) = 0 0
    stat64("file-2.txt\0", 0x7FFEE1B607D8, 0x0) = -1 Err#2
    lstat64("file.txt\0", 0x7FFEE1B60868, 0x0) = 0 0
    umask(0x1FF, 0x0, 0x0) = 18 0
    umask(0x12, 0x0, 0x0) = 511 0
    fstatat64(0xFFFFFFFFFFFFFFFE, 0x7FFB66D001C8, 0x7FFB66D001D8) = 0 0
    stat64("file-2.txt\0", 0x7FFEE1B608F8, 0x0) = -1 Err#2
    open("file.txt\0", 0x0, 0x0) = 3 0
    open("file-2.txt\0", 0x601, 0x81A4) = 4 0
    fstatfs64(0x4, 0x7FFEE1B5FA88, 0x0) = 0 0
    fstat64(0x4, 0x7FFEE1B5FA88, 0x0) = 0 0
    fchmod(0x4, 0x8180, 0x0) = 0 0
    dtrace: error on enabled probe ID 2166 (ID 159: syscall::read:return): invalid kernel access in action #12 at DIF offset 68
    dtrace: error on enabled probe ID 2164 (ID 161: syscall::write:return): invalid kernel access in action #12 at DIF offset 68
    dtrace: error on enabled probe ID 2166 (ID 159: syscall::read:return): invalid kernel access in action #12 at DIF offset 68
    fchmod(0x4, 0x81A4, 0x0) = 0 0
    fstat64_extended(0x3, 0x7FFB66D00288, 0x7FFB66D003C0) = 0 0
    fstat64(0x4, 0x7FFEE1B5F950, 0x0) = 0 0
    fchmod(0x4, 0x1A4, 0x0) = 0 0
    __mac_syscall(0x7FFF564ACD02, 0x52, 0x7FFEE1B5F8D0) = -1 Err#93
    flistxattr(0x4, 0x0, 0x0) = 0 0
    flistxattr(0x3, 0x0, 0x0) = 0 0
    fchmod(0x4, 0x1A4, 0x0) = 0 0
    close(0x3) = 0 0
    close(0x4) = 0 0

So first things first, I’ve been doing this stack trace reads for a while and I’m rather curious about this bit.

    syscall::read:return): invalid kernel access in action #12 at DIF offset 68

It seems like this might be related to a process attempting to access memory blocks that it does not have access to. I decided to Google around to see what the Internet might have to say about this. After looking through several forum posts, Apple support posts, blog posts, and stack exchange posts, it appears that this error is related to Apple’s system integrity protection. It’s a feature that was released in El Captain that restricts what access the root user has and what they can do on protected parts of the operating system. You can read more about it [here](https://support.apple.com/en-us/HT204899). It’s actually a pretty neat concept.

Admittedly, I had a pretty easy time scrolling through this stack trace and figuring out what was going on. Most of the commands used are ones that I’m already familiar with, and it was generally easy to map how the program would flow.

There were two parts that caught my eye. This:

    __mac_syscall(0x7FFF564ACD02, 0x52, 0x7FFEE1B5F8D0) = -1 Err#93

And this:

    flistxattr(0x4, 0x0, 0x0) = 0 0
    flistxattr(0x3, 0x0, 0x0) = 0 0

I figured it would be easy to start off by looking into that second syscall, since the `__mac_syscall` bit is completely opaque to me. I started to look into the `flistxattr` command and by “look into” I mean “Google.” I found some useful documentation on that [here](http://man7.org/linux/man-pages/man2/listxattr.2.html). So it looks like this command is adding a new set of attributes representing each of the files. The function declaration of this function looks like this.

    ssize_t flistxattr(int fd, char *list, size_t size);

So from the trace above, it looks like the pare parameter that is different between the two syscalls is `fd`, which is a reference to the file descriptor. In this case, I assume it is setting the `name:value` attributes on the original file and the copy.

Now to that interesting `__mac_syscall(0x7FFF564ACD02, 0x52, 0x7FFEE1B5F8D0)` bit. What I found was interesting was that the result of this function call resulted in an error. To investigate what this call does, I did some Googling. After reading a blog post, several StackOverflow posts, and a thesis, I eventually found the implementation for this function in the Darwin code base. You can read it [here](https://github.com/apple/darwin-xnu/blob/0a798f6738bc1db01281fc08ae024145e84df927/security/mac_base.c#L1721). The most important part of the code snippet I found is the comment on it.

    /*
     * __mac_syscall: Perform a MAC policy system call
     *
     * Parameters: p Process calling this routine
     * uap User argument descriptor (see below)
     * retv (Unused)
     *
     * Indirect: uap->policy Name of target MAC policy
     * uap->call MAC policy-specific system call to perform
     * uap->arg MAC policy-specific system call arguments
     *                
     * Returns: 0 Success
     * !0 Not success
     *
     */
    int
    __mac_syscall(proc_t p, struct__mac_syscall_args *uap, int *retv __unused)

I did some research to figure out what MAC policies were and discovered that they are a security-related construct. You can read more about them [here](https://www.freebsd.org/doc/en/books/arch-handbook/mac-policy-architecture.html). After reading that referenced link, that system call above makes a whole lot more sense. With that little bit squared away, the stack trace has a bit more clarity too.

Until the next post!

