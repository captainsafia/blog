---
layout: post
title: 'Looking at the curl stack trace: part 1'
date: '2018-05-14T10:00:46-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173894908867/looking-at-the-curl-stack-trace-part-1
---
As mentioned in my [last blog post](https://blog.safia.rocks/2018-05-11-looking-at-how-curl-works-through-stack-traces/), I’m hoping to do a thorough analysis of the `strace` for curl in the next couple of blog posts. I started looking through the stack trace in the last blog post, but I quickly realized that it would take more than one blog post to look through everything so here I am.

Alright, here’s the first chunk of the stack trace that I’ll be looking through.

    [pid 8819] set_robust_list(0x7f21c40f09e0, 24) = 0
    [pid 8819] socket(AF_UNIX, SOCK_STREAM|SOCK_CLOEXEC|SOCK_NONBLOCK, 0) = 3
    [pid 8819] connect(3, {sa_family=AF_UNIX, sun_path="/var/run/nscd/socket"}, 110) = -1 ENOENT (No such file or directory)
    [pid 8819] close(3) = 0
    [pid 8819] socket(AF_UNIX, SOCK_STREAM|SOCK_CLOEXEC|SOCK_NONBLOCK, 0) = 3
    [pid 8819] connect(3, {sa_family=AF_UNIX, sun_path="/var/run/nscd/socket"}, 110) = -1 ENOENT (No such file or directory)
    [pid 8819] close(3)    

The first system call made in this stack trace is `set_robust_list`. This is not one that I’ve encountered before, so I headed over to [the docs](https://linux.die.net/man/2/set_robust_list).

> The set\_robust\_list() system call requests the kernel to record the head of the list of robust futexes owned by the calling thread.

Aha! Futexes. I learned about these a while ago in a systems class. Futexes are a low-level multi-threading construct. They allow you to implement locking (a way for a thread to claim control over a resource so that other threads cannot access it at the same time). You can read more about futexes [here](https://opensourceforu.com/2013/12/things-know-futexes/). I’m guessing that the `curl` process spins out some threads to do background work and this `set_robust_list` function call is related to those soon-to-be created threads.

Following that, the program attempts to open two socket connections. I wasn’t sure what the point of these socket connections would be. It seemed too early to be opening any sockets in the program. I decided to do some Googling on the “/var/run/nscd/socket” bit to see if that might illuminate what the socket connections are for. I came across [this blog post](https://jameshfisher.com/2018/02/05/dont-use-nscd.html) which explained that `nscd` is used to run a local DNS resolver. A local DNS resolver is a program that performs a lookup for an IP address for a particular domain on a local machine. As it turns out, the attempt to open a socket to the local DNS server on the machine failed because there isn’t one running on the machine that I executed the `curl` command in. As it turns out, this relates to some system calls that are made later down the line.

Speaking of which, the next chunk of the stack trace looks like this.

    [pid 8819] open("/etc/nsswitch.conf", O_RDONLY|O_CLOEXEC) = 3
    [pid 8819] fstat(3, {st_mode=S_IFREG|0644, st_size=497, ...}) = 0
    [pid 8819] read(3, "# /etc/nsswitch.conf\n#\n# Example"..., 4096) = 497
    [pid 8819] read(3, "", 4096) = 0
    [pid 8819] close(3) = 0

I’m not familiar with the `nsswitch.conf` file. That’s no surprise, a lot of things in this stack trace are new to me. The [docs](http://man7.org/linux/man-pages/man5/nsswitch.conf.5.html) revealed that this configuration file is used to store name resolution details for different. The important line in this file when it comes to `curl` is below.

    hosts: files dns

This line states that host names should first be resolved by looking in any configuration files then through a DNS service.

The next chunk of the stack trace relates closely to what the `nsswitch.conf` file revealed.

    [pid 8819] open("/etc/host.conf", O_RDONLY|O_CLOEXEC) = 3
    [pid 8819] fstat(3, {st_mode=S_IFREG|0644, st_size=9, ...}) = 0
    [pid 8819] read(3, "multi on\n", 4096) = 9
    [pid 8819] read(3, "", 4096) = 0
    [pid 8819] close(3)   

In this case, `curl` looks through the `host.conf`, which is a file that dictates how hostnames are resolved to IP addresses. This file can have some verastile configurations but in this case it contains only one, `multi on`, which dictates that a host stored in the hosts file (`/etc/hosts`) can reference multiple IP addresses.

The next couple of lines in the stack trace relate to the other part of the configuration in `nsswitch.conf`. The `curl` command opens up the `resolv.conf` file which contains a list of [name servers](https://en.wikipedia.org/wiki/Name_server) that our computer can query to resolve domain names.

    [pid 8819] futex(0x7f21c8974a64, FUTEX_WAKE_PRIVATE, 2147483647) = 0
    [pid 8819] getpid() = 8818
    [pid 8819] open("/etc/resolv.conf", O_RDONLY|O_CLOEXEC) = 3
    [pid 8819] fstat(3, {st_mode=S_IFREG|0644, st_size=111, ...}) = 0
    [pid 8819] read(3, "domain c.sky-eniac-f13b2.internal"..., 4096) = 111
    [pid 8819] read(3, "", 4096) = 0
    [pid 8819] close(3)  

So in summary, the first couple of system calls executed by the `curl` command show that the first task it handles is associated with resolving the IP address for the domain name that is entered in the command. In this case, it was `https://safia.rocks`. I think this point is a good place to end this blog post. I’ll pick up looking through the rest of the stack trace in the next blog post. See (write?) you then!

