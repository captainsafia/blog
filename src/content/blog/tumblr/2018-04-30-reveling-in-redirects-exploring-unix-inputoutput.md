---
layout: post
title: 'Reveling in redirects: exploring Unix input/output redirection'
date: '2018-04-30T17:42:38-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173462510565/reveling-in-redirects-exploring-unix-inputoutput
---
One of my favorite Linux features is redirection. Redirection gives you the ability to send the output of one command directly to another. For example, here’s how I would copy the contents of a file into my computer’s clipboard using a pipe redirection.

    $ cat file.txt | pbcopy

I can also use redirection to add some text to a file.

    $ echo "New stuff." > file.txt

All of this got me curious about something: how does redirection work? I have a partial answer to this question from my university coursework on computer science. It relates to the way that Unix executes a process. In this case, two system calls will be used: `fork` and `exec`.

`fork` is a command that copies all the details of the currently running process. A process is an entity that represents a program that is currently running. In Linux, the details of a process are stored in `task_struct` You can read through the definition of the `task_struct` [in this file in the Linux code base](https://github.com/torvalds/linux/blob/master/include/linux/sched.h). When a process is forked, a copy of the `task_struct` associated with that process is made. If you read through the struct definition, you’ll notice it stores things like the `state` of the process or the `pid`of the process.

`exec` is a command that overwrites the attributes of the currently running process with the details associated with a program (like the `ls` or `cat` programs). Generally what happens is that the `fork` system call is made a new copy of the currently running process is made. This copy is now the new currently running process. Then the `exec` call is made, and a new program is loaded into that process.

The fact that the act of creating a new process and starting to execute a program are distinct steps allow us to do some interesting things in between the `fork` and `exec` steps. For example, implementing a redirect from an `echo` command to a file as seen in the example above would look like.

1. Open the file `file.txt` with a file descriptor of 1.
2. Fork the currently running process.
3. Execute the command `echo "New stuff.`

They key here is the fact that we opened the file `file.txt` with a file descriptor set to 1. File descriptors are an abstract way of representing how any input/output resource (like a file) should be accessed. Generally, all process have access to three file descriptors numbered 0, 1, and 2. These numbers seem arbitrary (and that’s kinda because they are). A better way to refer to them is through the constants that they are assigned to which are `STDIN_FILENO`, `STDOUT_FILENO`, and `STDERR_FILENO`, respectively.

So in essence, in the steps above, we are mapping over the file descriptor associated with standard out to a file (instead of output on the console). When we fork the process, this file descriptor mapping is copied over as well and used when we execute the `echo` command.

OK. So now that I’ve explained all that, I want to try to actually see it in action. To do this, I hopped on over to the good ol’ `dtruss` tool and tried to figure out what a stack trace of the command `echo "New text." > file.txt` might be able to tell me about this.

Sidebar: Since I was trying to find the stack trace for a command that included redirection, I couldn’t just run `dtruss <command here>`as usual. Instead, I ended up connecting `dtruss` to a bash session and looking through the stack trace associated with the commands executed in that session. Below, I’ve extracted the system calls that I think are associated with redirection.

    29949/0x6d9b91: fork() = 0 0
    29949/0x6d9b91: thread_selfid(0x0, 0x0, 0x0) = 7183249 0
    29949/0x6d9b91: issetugid(0x0, 0x0, 0x0) = 0 0
    29949/0x6d9b91: csrctl(0x0, 0x7FFEE483CF7C, 0x4) = -1 Err#1
    29949/0x6d9b91: csops(0x0, 0x0, 0x7FFEE483D890) = 0 0
    29949/0x6d9b91: shared_region_check_np(0x7FFEE483CDD8, 0x0, 0x0) = 0 0
    29949/0x6d9b91: stat64("/private/var/db/dyld/dyld_shared_cache_x86_64h\0", 0x7FFEE483CD20, 0x0) = 0 0
    29949/0x6d9b91: csrctl(0x0, 0x7FFEE483CADC, 0x4) = -1 Err#1
    29949/0x6d9b91: getpid(0x0, 0x0, 0x0) = 29949 0
    29949/0x6d9b91: proc_info(0x2, 0x74FD, 0x16) = 1272 0
    29949/0x6d9b91: ioctl(0x3, 0x80086804, 0x7FFEE483CE50) = 0 0
    29949/0x6d9b91: close(0x3) = 0 0
    29949/0x6d9b91: access("/AppleInternal/XBS/.isChrooted\0", 0x0, 0x0) = -1 Err#2
    29949/0x6d9b91: thread_selfid(0x0, 0x0, 0x0) = 7183249 0
    29949/0x6d9b91: bsdthread_register(0x7FFF56790BEC, 0x7FFF56790BDC, 0x2000) = 1073742047 0
    29949/0x6d9b91: issetugid(0x0, 0x0, 0x0) = 0 0
    29949/0x6d9b91: mprotect(0x10B3CB000, 0x1000, 0x0) = 0 0
    29949/0x6d9b91: mprotect(0x10B3D0000, 0x1000, 0x0) = 0 0
    29949/0x6d9b91: mprotect(0x10B3D1000, 0x1000, 0x0) = 0 0
    29949/0x6d9b91: mprotect(0x10B3D6000, 0x1000, 0x0) = 0 0
    29949/0x6d9b91: mprotect(0x10B3C9000, 0x88, 0x1) = 0 0
    29949/0x6d9b91: mprotect(0x10B3D7000, 0x1000, 0x1) = 0 0
    29949/0x6d9b91: mprotect(0x10B3C9000, 0x88, 0x3) = 0 0
    29949/0x6d9b91: mprotect(0x10B3C9000, 0x88, 0x1) = 0 0
    29949/0x6d9b91: getpid(0x0, 0x0, 0x0) = 29949 0
    29949/0x6d9b91: stat64("/AppleInternal/XBS/.isChrooted\0", 0x7FFEE483C528, 0x0) = -1 Err#2
    29949/0x6d9b91: stat64("/AppleInternal\0", 0x7FFEE483C5C0, 0x0) = -1 Err#2
    29949/0x6d9b91: csops(0x74FD, 0x7, 0x7FFEE483C060) = 0 0
    dtrace: error on enabled probe ID 2190 (ID 557: syscall::sysctl:return): invalid kernel access in action #11 at DIF offset 28
    29949/0x6d9b91: csops(0x74FD, 0x7, 0x7FFEE483B950) = 0 0
    29949/0x6d9b91: writev(0x1, 0x7FE5BE601210, 0x2) = 13 0

So the first system call made is the `fork` system call that I discussed earlier. Based on my knowledge, the next few system calls after it should be associated with mapping the standard output file descriptor to the `file.txt` file. I tried to pick out the system calls that might be associated with this and isolated the following.

    29949/0x6d9b91: ioctl(0x3, 0x80086804, 0x7FFEE483CE50) = 0 0
    29949/0x6d9b91: close(0x3) = 0 0

`ioctl`as discussed in previous blog posts is the system call associated with managing interactions it I/O resources like files. The first parameter passed to this function is the associated file descriptor. In this case, it is `0x3`. I figure that this is the call associated with opening the `file.txt` file because the first 0-2 file descriptors are used by the operating system as mentioned above.

The other significant function call is all the way at the bottom.

    29949/0x6d9b91: writev(0x1, 0x7FE5BE601210, 0x2) = 13 0

I’ve never encountered this `writev` system call before, so I decided to research it further. When I read [the documentation](https://linux.die.net/man/2/writev), the most approachable definition I found for the system call was as follows.

> The writev() system call works just like write(2) except that multiple buffers are written out.

This is my hunch, but I’m perplexed by the fact that the file descriptors don’t match up. If we open the file at file descriptor `0x3` and write to file descriptor `0x1` then where is the actual redirection happening? I wondered if the request code passed to the `ioctl` did something to connect the two file descriptor. Or maybe there was some code that took care of executing the redirection that wouldn’t show up in the system call?

In any case, this blog post is getting a little long, and my commute to work is almost over (I write these blog posts on the trip to work), so I’ll have to continue this particular investigation in another blog post.

See you then! And hopefully, I’ll have more clarity on this whole affair at that point.

