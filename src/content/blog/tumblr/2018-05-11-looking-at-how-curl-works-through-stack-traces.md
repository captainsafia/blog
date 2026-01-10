---
layout: post
title: Looking at how `curl` works through stack traces
date: '2018-05-11T11:01:11-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173800368826/looking-at-how-curl-works-through-stack-traces
---
It’s the end of the week! Woohoo! I’m very excited for the weekend. It’s the only time I have these days to get lots of coding done on [Zarf](https://zarf.co/).

The first couple of relevant lines in the stack trace are pretty self-explanatory. They capture writing the command to standard input (which is defined through file descriptor 2). The one call that intrigued me was the `pselect6` call, primarily because I haven’t encountered it before. As it turns out `pselect6` is responsible for determining whether a file descriptor in a set of file descriptors is ready for interactions. The first two commands are the number of file descriptors to observe and the second is the set of file descriptors to observe. In this case, `pselect` is only observing the state of file descriptor 0. File descriptor 0 is the standard input file descriptor, so I’m assuming that this system call does something to the effect of checking to see if a user isn’t actively typing a command.

    write(2, "curl https://safia.rocks", 24) = 24
    pselect6(1, [0], NULL, NULL, NULL, {[], 8}) = 1 (in [0])
    read(0, "\r", 1) = 1
    write(2, "\n", 1) = 1

The next couple of lines in the stack trace invoke a command that I’m familiar with using a rather interesting set of parameters. As mentioned in other blog posts, `ioctl` is a command that is

    ioctl(0, TCGETS, {B38400 opost isig -icanon -echo ...}) = 0
    ioctl(0, SNDCTL_TMR_STOP or TCSETSW, {B38400 opost isig icanon echo ...}) = 0
    ioctl(0, TCGETS, {B38400 opost isig icanon echo ...}) = 0

The next few lines were variations of this. I’ve never encountered the `rt_sigaction`

    rt_sigaction(SIGINT, {sa_handler=0x467410, sa_mask=[], sa_flags=SA_RESTORER, sa_restorer=0x7f
    3750fe6060}, {sa_handler=0x4bb540, sa_mask=[], sa_flags=SA_RESTORER, sa_restorer=0x7f3750fe60
    60}, 8) = 0

The next couple of lines in the stack trace made me realize that I had not configured `strace` properly before running my `curl` command. In the stack trace below, there is a call made to the `clone` syscall which creates a new process thread. Shortly after this new thread is created, the stack trace ends. This made me realize that a lot of the networking-related work must have been happening in that thread. In particular, I was looking to find system calls associated with opening sockets and `recv`ing messages from them.

    pipe([3, 4]) = 0
    clone(child_stack=NULL, flags=CLONE_CHILD_CLEARTID|CLONE_CHILD_SETTID|SIGCHLD, child_tidptr=0
    x7f375199ae10) = 13439 = 0

I went back and reran the `strace` command with the appropriate flag, the `f` flag, which tells `strace` to _f_ollow child processes and threads. When I did this, I got a stack trace that was much longer and had a lot of the system calls that I expected to see. One of the first networking-related things that happen is related to configurations. In this case, it loads up the default configuration that a user might have set for curl.

    [pid 13601] open("/usr/lib/ssl/openssl.cnf", O_RDONLY) = 3
    ...
    [pid 13601] open("/home/safia/.curlrc", O_RDONLY)

As I scrolled through the rest of the stack trace, I realized that it was the kind of thing that should be analyzed in multiple series. Considering the amount of time I have to write these days, I have to keep my blog posts really short. I don’t mind this too much. In this case, it’ll allow me to parse out this rather hefty stack trace without losing it.

So stay tuned for that!

