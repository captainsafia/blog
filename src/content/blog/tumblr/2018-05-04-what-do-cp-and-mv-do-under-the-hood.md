---
layout: post
title: What do `cp` and `mv` do under the hood?
date: '2018-05-04T08:27:29-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173575812210/what-do-cp-and-mv-do-under-the-hood
---
Another Friday, another blog post! Can you believe I’ve written around 50 blog posts in the last four months? I certainly can’t! I feel like it gets easier every time, so the adage is true: practice does make perfect.

Today, I’d like to make another helpless Unix command my victim. Well, two of them actually, I’ve recently been interested in the distinctions between the `mv` command and the `copy` command. I have the vaguest hunch that under the hood, they actually mostly do the same thing, but this blog isn’t about unsubstantiated hunches. Let’s see if we can see what the difference might be from the stack trace.

I ran `strace` on the following commands. `mv test-1.txt test-2.txt` and `cp test-3.txt test-4.txt`.

The stack trace for the `mv` command actually ended up being shorter and much easier to process. The first couple of lines are responsible for checking to see if a file with the filename that we want to `mv` to already exists.

I wasn’t sure what the distinction between `stat` and `lstat` was. I knew what it was at some point but that was many moons ago, and I needed to jog my memory. It turns out that they both essentially do the same thing (return the attributes of an inode) expect that lstat doesn’t run `stat` on the original `inode` pointed to by a symbolic link but on the symbolic link itself. It’s a way of getting the stats on the reference instead of the actual file.

The last invocation is to the `rename` system call which is responsible for changing the name or location of a file ([documentation](http://man7.org/linux/man-pages/man2/rename.2.html)) does most of the heavy lifting here.

    stat("test-2.txt", 0x7ffd03574f90) = -1 ENOENT (No such file or directory)
    lstat("test-1.txt", {st_mode=S_IFREG|0644, st_size=13, ...}) = 0
    lstat("test-2.txt", 0x7ffd03574c70) = -1 ENOENT (No such file or directory)
    rename("test-1.txt", "test-2.txt") = 0

The `cp` command had a lot more going on. As it turns out, they are quite different. I dunno why I thought they would be similar. In hindsight, that didn’t make sense. I guess those are the kind of assumptions you make when you’re writing blog posts at 50 miles an hour in a rideshare with a bunch of strangers without having had any coffee or tea yet.

The stack trace for the `cp` command starts with the same `stat` commands that were used in the `mv` command.

Then both files are opened, the existing file for reading and the new file for writing. I found the `fstat` calls that are referenced her to be interesting. Again, there is a murky recollection of what `fstat` does in the back of my mind. After [looking up the documentation](https://linux.die.net/man/2/fstat), I realized that looking at the parameters used in the system call would have actually revealed its purpose. The parameters, `3` and `4`, are references to the file descriptors of the files that were opened for reading and writing. As such, `fstat` is used to fetch the file attributes of these files before writing to them.

There’s a seemingly random call to the `fadvise64` system call after that. I’ve never encountered this command, and after [looking it up](https://linux.die.net/man/2/fadvise64), I realized that it was pretty nifty. Apparently, it’s how the program can inform the operating system of its intentions with respect to accessing a particular file. This way the operating system can make the appropriate optimizations depending on what those intentions are. For example, if the plan is to copy data, the operating system might position the data copied and the location copied to be closer to each other.

Afterward, data is read from the old file and written to the new file. There’s not much fun stuff going on here, and I think the system calls are pretty self-explanatory.

    stat("test-4.txt", 0x7ffd15bf1830) = -1 ENOENT (No such file or directory)
    stat("test-3.txt", {st_mode=S_IFREG|0644, st_size=13, ...}) = 0
    stat("test-4.txt", 0x7ffd15bf15a0) = -1 ENOENT (No such file or directory)
    open("test-3.txt", O_RDONLY) = 3
    fstat(3, {st_mode=S_IFREG|0644, st_size=13, ...}) = 0
    open("test-4.txt", O_WRONLY|O_CREAT|O_EXCL, 0644) = 4
    fstat(4, {st_mode=S_IFREG|0644, st_size=0, ...}) = 0
    fadvise64(3, 0, 0, POSIX_FADV_SEQUENTIAL) = 0
    mmap(NULL, 139264, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x7f875a6b600
    0
    read(3, "Lorem ipsum.\n", 131072) = 13
    write(4, "Lorem ipsum.\n", 13) = 13
    read(3, "", 131072) = 0
    close(4) = 0
    close(3) = 0

See you in the next blog post!

