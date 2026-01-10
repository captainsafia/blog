---
layout: post
title: 'Unraveling `rm`: what happens when you run it?'
date: '2018-04-23T19:05:37-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173241985600/unraveling-rm-what-happens-when-you-run-it
---
Another Monday, another blog post!

I’ve been diving into the curl codebase over the past couple of blog posts, but something else has spiked my interest today, so I figured I might as well dig into it while the curiosity is still hot.

To be honest, I’m reluctant to dive into this because the last time I wrote a blog post about a Unix-related topic the — let’s call them the group of individuals with too much time on their hands and a lot of petty on their hearts — took me to task on some of the substance in the blog post in a way that wasn’t too nice. And by “wasn’t too nice” I mean hella racist and sexist. In any case, I figure there will always be haters (and people with unhealthy attachments to operating systems and harassing strangers on the Internet), so I might as well carry on.

OK. Enough blabber. I’ve been working through a backlog of issues on the [Zarf](https://zarf.co/) app. As such, I’ve been spending a lot of time on the command line. The backlog involved deleting a lot of code (insert satisfied sigh here) and sometimes this involved deleting entire files of source code (insert doubly satisfied sigh here). This got me wondering: what’s going on when you run `rm` on the command line. There’s a couple of variants of the `rm` command that I commonly run.

    $ rm settings.json
    $ rm -rf config/

Anyways, I wanted to dive into what is going on under the hood with `rm`, so I decided to start by determining the syscalls invoked by the `rm` command.

    captainsafia@eniac ~/zarf> sudo dtruss /tmp/rm History.md
    dtrace: system integrity protection is on, some features will not be available
    
    SYSCALL(args) = return
    open("/dev/dtracehelper\0", 0x2, 0xFFFFFFFFE9A3EB10) = 3 0
    ioctl(0x3, 0x80086804, 0x7FFEE9A3EA70) = 0 0
    close(0x3) = 0 0
    access("/AppleInternal/XBS/.isChrooted\0", 0x0, 0x0) = -1 Err#2
    thread_selfid(0x0, 0x0, 0x0) = 3765033 0
    bsdthread_register(0x7FFF56790BEC, 0x7FFF56790BDC, 0x2000) = 1073742047 0
    issetugid(0x0, 0x0, 0x0) = 0 0
    mprotect(0x1061CA000, 0x1000, 0x0) = 0 0
    mprotect(0x1061CF000, 0x1000, 0x0) = 0 0
    mprotect(0x1061D0000, 0x1000, 0x0) = 0 0
    mprotect(0x1061D5000, 0x1000, 0x0) = 0 0
    mprotect(0x1061C8000, 0x88, 0x1) = 0 0
    mprotect(0x1061D6000, 0x1000, 0x1) = 0 0
    mprotect(0x1061C8000, 0x88, 0x3) = 0 0
    mprotect(0x1061C8000, 0x88, 0x1) = 0 0
    getpid(0x0, 0x0, 0x0) = 77384 0
    stat64("/AppleInternal/XBS/.isChrooted\0", 0x7FFEE9A3E148, 0x0) = -1 Err#2
    stat64("/AppleInternal\0", 0x7FFEE9A3E1E0, 0x0) = -1 Err#2
    csops(0x12E48, 0x7, 0x7FFEE9A3DC80) = 0 0
    dtrace: error on enabled probe ID 2190 (ID 557: syscall::sysctl:return): invalid kernel access in action #10 at DIF offset 28
    csops(0x12E48, 0x7, 0x7FFEE9A3D570) = 0 0
    geteuid(0x0, 0x0, 0x0) = 0 0
    ioctl(0x0, 0x4004667A, 0x7FFEE9A3F954) = 0 0
    lstat64("History.md\0", 0x7FFEE9A3F8F8, 0x0) = 0 0
    access("History.md\0", 0x2, 0x0) = 0 0
    unlink("History.md\0", 0x0, 0x0) = 0 0

Sidebar: Usually, you determine the syscalls utilized by a command by using `strace`. I’m on a Mac so `strace` isn’t available. Instead, I used a tool called `dtrace`. To allow it to process the `rm` command, I had to make a copy of the executable into a temporary directory and execute that. All this to say, this is why I’m executing `dtrace /tmp/rm` above instead of `strace rm`.

So, anyway, let’s look into what’s going on above. The first couple of lines in the trace seem to be pretty clearly related to setting up the `sudo` part of the command. I was intrigued by the calls to the `mprotect` command. I figured that it might be something related to memory addresses because the first parameter passed to the `mprotect` function looks like a memory address. I decided to head over to Google to see if I could find the documentation for this function and confirm this. I find the documentation [here](http://man7.org/linux/man-pages/man2/mprotect.2.html) and my suspicions were confirmed. The function is responsible for setting the access rights on memory for the calling process. The function declaration looks like this `int mprotect(void *addr, size_t len, int prot)` where `addr` is the start of the memory range, and `len` is the length of range of memory addresses that will be changed, and `prot` is an integer that represents how the memory should be protected. I looked into what the different values for `prot` that were passed into the `mprotect` function calls above and figured out the following.

1. `0x0` is the code for `PROT_NONE` meaning that the memory cannot be accessed for writes or reads.
2. `0x1` is the code for `PROT_READ` meaning that the memory can be read.
3. `0x3` is a bitwise OR of the values for `PROT_READ` and `PROT_WRITE` which means that it allows that memory to be both read or written.

I wasn’t sure what the memory addresses that were referenced in the `mprotect` call actually corresponded to or what the best way to figure it would be.

The `getpid` command has a pretty self-explanatory name, but I wondered what the parameters that were passed to the function were. As it turns out, the `getpid` function supposedly takes no parameters, so the inclusion of the parameters in the call above perplexed me.

I was also unsure of what the `csops` and `ioctl` calls did. As it turns out, this is actually pretty warranted. Some investigation [revealed](https://github.com/axelexic/CSOps) that `csops` is a system call that is unique to the Apple operating system and can be used to check the signature that is written into a memory page by the operating system. It seems to be some way of checking the validity of a particular chunk of code. I’m not too sure about it, and there isn’t a ton of information about Apple-specific syscalls so I can’t dig into the details of this as well as I’d like.

The `ioctl` syscall is a pretty versatile one and is responsible for all input/output related interactions. According to [the manpage](http://man7.org/linux/man-pages/man2/ioctl.2.html), the first argument represents a file descriptor, the second is a reference to a “device-dependent request code”, and the third is a pointer to memory. I dug around to figure out what the request code “0x4004667A” and realized that it was pretty commonly associated with invocations of the `dtrace` command so I figured that this invocation was not related to the task of removing the file referenced.

I was interested in the last syscall invoked in this strace, `unlink`. I headed back to Google to learn some more about it and came across [this manpage](http://man7.org/linux/man-pages/man2/unlink.2.html). The `unlink` command is the one that is actually responsible for removing the file.

All in all, the most `rm`-related parts of the trace are in the last few lines. Everything else seems to be setup associated with setting up memory permissions, ensuring the status of the related files, and setting up the `dtrace` command.

So there’s that! I’ll admit that I’m not sure how I feel about this trace approach to antropology. It’s a little too direct, I almost like wallowing in the code and getting last in the complexity of it. There is something therapeutic about it. I’ll see if I get more comfortable with this technique in future code reads. Until then, see you next time!

