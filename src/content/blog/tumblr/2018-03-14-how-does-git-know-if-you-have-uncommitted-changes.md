---
layout: post
title: How does Git know if you have uncommitted changes in the working tree? (Part
  1)
date: '2018-03-14T10:41:00-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/171866471130/how-does-git-know-if-you-have-uncommitted-changes
---
In one of my last blog posts, I started digging into how `git-status` works. I ended up going into a little bit of a rabbit hole. As it turns out, the `git-status` command intersects with the Git differ and the way that state about the current working tree is managed. I ended up setting aside two specific questions to answer in my blog post.

- How does Git execute diffs and how does it manage diffed state?
- How does Git manage the state of the working tree?

In my last blog post, I answered the second question pretty fully. In this blog post, I’d like to tackle the first question. So let’s get right into it!

As a remainder, the relevant chunk of code that I am looking into is in the portion of the code base that is responsible for checking whether or not there are currently uncommitted changes in a repository. The function looks something like this.

    int has_uncommitted_changes(int ignore_submodules)
    {
        struct rev_info rev_info;
        int result;
    
        if (is_cache_unborn())
            return 0;
    
        init_revisions(&rev_info, NULL);
        if (ignore_submodules)
            rev_info.diffopt.flags.ignore_submodules = 1;
        rev_info.diffopt.flags.quick = 1;
        add_head_to_pending(&rev_info);
        diff_setup_done(&rev_info.diffopt);
        result = run_diff_index(&rev_info, 1);
        return diff_result_code(&rev_info.diffopt, result);
    }

Sidebar: I dunno why I said “something like this.” The above is the exact definition of the function per the pinned version of the code base I’ve been reading. Ya get what I mean…

I get the send that this is gonna end up being one of those code reads that I leave with more questions than answers. As I’ve said many times before, such is life.

The first thing I wanted to dig into is the `rev_info` struct that is used throughout the code snippet above. So what does the definition of the `rev_info` struct look like. Well, let me tell you, it’s got a whole lot going on. [Here](https://github.com/git/git/blob/c6284da4ff4afbde8211efe5d03f3604b1c6b9d6/revision.h#L55)’s a link to the definition for those who are brave.

If I included the code for the `rev_info` struct, it would be far too much. Instead, I’ll try my best to summarize the parts of hte struct that are used in the code snippet above.

The `diffopt` variable represents a `diff_options` structure. The `diff_options` struct which includes options related to the generation of the diff between files.

The `ignore_submodules` flag dicates whether or not changes in submodules should be considered.

It took a while to figure out what the `quick` flag did. I’m not totally sure but from reading how the flag is used throughout the codebase, I figure that it is used in the same way that the `--brief` flag works for the `diff` command in Unix. In sum, it only shows output when files differ. The line of code that hinted me towards this is [here](https://github.com/git/git/blob/c6284da4ff4afbde8211efe5d03f3604b1c6b9d6/builtin/rev-list.c#L410-L411). In sum, when the `quick` flag is set to true the `REV_LIST_QUIET` flag is toggled.

OK. I hope that made sense. It’s really hard to convey what these structs represent because it involves reading chunks of code across disparate places and then trying to piece together a sense of what might be going on. It’s a lot like solving a puzzle. And some things don’t translate well unless you’ve had the experience of solving the puzzle.

Anyways, the next thing that I wanted look into is the `init_revisions` function. The name is a big hint as to what the function does. It initializes the `rev_info` struct with some default configurations. There’s also some other business going on with [`init_grep_defaults`](https://github.com/git/git/blob/d0db9edba0050ada6f6eac68061599690d2a4333/revision.c#L1440), but I’ll into that at some other point. Stay focused, Safia!

The next function to look into is the `add_head_to_pending` function. This function is one of those functions with a few lines of code but a lot going on underneath.

    void add_head_to_pending(struct rev_info *revs)
    {
        struct object_id oid;
        struct object *obj;
        if (get_oid("HEAD", &oid))
            return;
        obj = parse_object(&oid);
        if (!obj)
            return;
        add_pending_object(revs, obj, "HEAD");
    }

Alright! So it looks like we are messing around with objects here. If you’ve been around this blog for a while, I dived into this a little bit in the first blog post where I explored the contents of the Git directory.

I think this is a good point to stop and set aside some questions to guide future explorations. Some things I wanna figure out are:

- What does `init_grep_defaults` do?
- What is an object from a filesystem perspective and from a data structure perspective?
- What does it mean to add an object to HEAD?
- Why is the `rev_info` struct so damn dense?

That being said, I thought it was pretty good that I clarified what `rev_info` was in the context of Git. Like I said before, I knew I was gonna leave this with more questions than answers.

Until next time! I gotta go to bed…

