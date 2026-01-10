---
layout: post
title: 'Looking into curl: part 2'
date: '2018-05-16T17:57:17-07:00'
tags: []
---
Is it Wednesday already? I guess it is. To be honest, I pretty much write these blog posts on auto-pilot, so the time passes by really quickly.

I’m continuing the series that I started on Monday where I analyze the `strace` for `curl`. In the last blog post, I looked into how the `curl` process managed domain name resolution. I’ll continue from there in this blog post.

The next chunk of the trace looks like the following.

Sidebar: I dunno why I say “looks like,” this is exactly what it is. Alas, inner monologues lack precision.

```
    socket(AF_INET, SOCK_DGRAM|SOCK_NONBLOCK, IPPROTO_IP) = 3
    [pid 8819] connect(3, {sa_family=AF_INET, sin_port=htons(53), sin_addr=inet_addr("169.254.169.254")}, 16) = 0
    [pid 8819] poll([{fd=3, events=POLLOUT}], 1, 0) = 1 ([{fd=3, revents=POLLOUT}])
    [pid 8819] sendmmsg(3, [{msg_hdr={msg_name=NULL, msg_namelen=0, msg_iov=[{iov_base="\252_\1\0\0\1\0\0\0\0\0\0\5safia\5rocks\0\0\1\0\1", iov_len=29}], msg_iovlen=1, msg_controllen=0, msg_flags=0}, msg_len=29}, {msg_hdr={msg_name=NULL, msg_namelen=0, msg_iov=[{iov_base="\375\266\1\0\0\1\0\0\0\0\0\0\5safia\5rocks\0\0\34\0\1", iov_len=29}], msg_iovlen=1, msg_controllen=0, msg_flags=MSG_EOR|MSG_CONFIRM|MSG_RST|MSG_MORE|MSG_WAITFORONE|MSG_CMSG_CLOEXEC|0x80200000}, msg_len=29}], 2, MSG_NOSIGNAL) = 2
    [pid 8819] poll([{fd=3, events=POLLIN}], 1, 5000 <unfinished ...>
    [pid 8818] <... poll resumed> ) = 0 (Timeout)
```

The first system call initiates a connection to an IP address. The IP address wasn’t giving me any clues, but I thought the port number it was connecting to was interesting: port 53. I looked this up, and as it turns out, port 53 is the default port number used by DNS servers. It appears that the connection it is making her is to a DNS server in an attempt to resolve the domain name. This suspicion was confirmed by the contents of the payload that is sent via the `sendmmsg` command later down the line.

```
    [pid 8819] ioctl(3, FIONREAD, [85]) = 0
    [pid 8819] recvfrom(3, "\375\266\201\200\0\1\0\2\0\0\0\0\5safia\5rocks\0\0\34\0\1\300\f\0"..., 2048, 0, {sa_family=AF_INET, sin_port=htons(53), sin_addr=inet_addr("169.254.169.254")}, [28->16]) = 85
    [pid 8819] poll([{fd=3, events=POLLIN}], 1, 4940) = 1 ([{fd=3, revents=POLLIN}])
    [pid 8819] ioctl(3, FIONREAD, [61]) = 0
    [pid 8819] recvfrom(3, "\252_\201\200\0\1\0\2\0\0\0\0\5safia\5rocks\0\0\1\0\1\300\f\0"..., 65536, 0, {sa_family=AF_INET, sin_port=htons(53), sin_addr=inet_addr("169.254.169.254")}, [28->16]) = 61
    [pid 8819] close(3)   
```

The next chunk of the stack trace reads data from some `gai.conf` file. I decided to look up what it might be responsible for in [the docs](http://man7.org/linux/man-pages/man5/gai.conf.5.html). `gai.conf` is a file that stores the configuration for the `getaddrinfo` function. The `getaddrinfo` function is responsible for a lot of the heavy lifting when it comes to mapping a hostname to an IP address that we can connect to. The configurations stored in `gai.conf` deal with what should be done when a call to `getaddrinfo` returns multiple responses. I assume this means that when a hostname resolves to multiple addresses. In this case, the `gai.conf` file allows us to persist information about which address we actually want to connect to.

```
    pid 8819] open("/etc/gai.conf", O_RDONLY|O_CLOEXEC) = 3
    [pid 8819] fstat(3, {st_mode=S_IFREG|0644, st_size=2584, ...}) = 0
    [pid 8819] fstat(3, {st_mode=S_IFREG|0644, st_size=2584, ...}) = 0
    [pid 8819] read(3, "# Configuration for getaddrinfo("..., 4096) = 2584
    [pid 8819] read(3, "", 4096) = 0
    [pid 8819] close(3) 
```

The next chunk of the stack trace was a little it more esoteric and difficult for me to parse. I noticed that the program was opening a new socket with an `AF_NETLINK` type. After researching this, I discovered that this particular connection type allows the kernel to communicate with the userspace. In this case, the socket isn’t facilitating a connection with the outside world. Unfortunately, knowing this doesn’t give me much context into what is actually being communicated over this socket. I’m making a mental to-do to go one layer up and see what looking through the `curl` code base again might tell me.

```
    [pid 8819] futex(0x7f21c8972ee4, FUTEX_WAKE_PRIVATE, 2147483647) = 0
    [pid 8819] socket(AF_NETLINK, SOCK_RAW, NETLINK_ROUTE) = 3
    [pid 8819] bind(3, {sa_family=AF_NETLINK, nl_pid=0, nl_groups=00000000}, 12) = 0
    [pid 8819] getsockname(3, {sa_family=AF_NETLINK, nl_pid=8818, nl_groups=00000000}, [12]) = 0
    ...
    [pid 8819] close(3)    
```

The next chunk of the trace is equally as esoteric for me. In this case, the socket connection made communicates with an IPv6 address. Again, completely clueless as to what is going on here. In addition to reading the code for `curl`, I think running Wireshark and looking at what the network dump tells me might illuminate more here. In any case, I’m not all that interested in getting into the nitty-gritty of what is going on here. It seems pretty clear that `curl` goes through quite a few steps to resolve a domain name from both local and remote DNS services.

```
    [pid 8819] socket(AF_INET6, SOCK_DGRAM, IPPROTO_IP) = 3
    [pid 8819] connect(3, {sa_family=AF_INET6, sin6_port=htons(443), inet_pton(AF_INET6, "2400:cb00:2048:1::681b:a05e", &sin6_addr), sin6_flowinfo=htonl(0), sin6_scope_id=0}, 28) = -1 ENETUNREACH (Network is unreachable)
    [pid 8819] connect(3, {sa_family=AF_UNSPEC, sa_data="\0\0\0\0\0\0\0\0\0\0\0\0\0\0"}, 16) = 0
    [pid 8819] connect(3, {sa_family=AF_INET6, sin6_port=htons(443), inet_pton(AF_INET6, "2400:cb00:2048:1::681b:a15e", &sin6_addr), sin6_flowinfo=htonl(0), sin6_scope_id=0}, 28) = -1 ENETUNREACH (Network is unreachable)
    [pid 8819] connect(3, {sa_family=AF_UNSPEC, sa_data="\0\0\0\0\0\0\0\0\0\0\0\0\0\0"}, 16) = 0
    [pid 8819] connect(3, {sa_family=AF_INET, sin_port=htons(443), sin_addr=inet_addr("104.27.160.94")}, 16) = 0
    [pid 8819] getsockname(3, {sa_family=AF_INET6, sin6_port=htons(56904), inet_pton(AF_INET6, "::ffff:10.128.0.2", &sin6_addr), sin6_flowinfo=htonl(0), sin6_scope_id=0}, [28]) = 0
    [pid 8819] connect(3, {sa_family=AF_UNSPEC, sa_data="\0\0\0\0\0\0\0\0\0\0\0\0\0\0"}, 16) = 0
    [pid 8819] connect(3, {sa_family=AF_INET, sin_port=htons(443), sin_addr=inet_addr("104.27.161.94")}, 16) = 0
    [pid 8819] getsockname(3, {sa_family=AF_INET6, sin6_port=htons(43230), inet_pton(AF_INET6, "::ffff:10.128.0.2", &sin6_addr), sin6_flowinfo=htonl(0), sin6_scope_id=0}, [28]) = 0
    [pid 8819] close(3) = 0
```
At this point, the process (thread) with PID 8819 exits and we return back to the main thread. I’ll start looking at that portion of the stack trace in the next blog post.

