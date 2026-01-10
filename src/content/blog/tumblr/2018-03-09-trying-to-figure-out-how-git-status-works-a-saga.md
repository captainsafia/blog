---
layout: post
title: 'Trying to figure out how git-status works: a saga'
date: '2018-03-09T09:08:47-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/171693534895/trying-to-figure-out-how-git-status-works-a-saga
---
The Git shennagins continue!

The next thing that I’d like to figure out is what happens when I execute `git status`. In particular, I’m curious to know how Git detects that the contents of the working directory have changed.

So I started poking around the code to figure out what code I could find that would be related to the working directory and its status. I found [a header file](https://github.com/git/git/blob/d0db9edba0050ada6f6eac68061599690d2a4333/wt-status.h) that defined a few enums, structs, and functions related to working tree status functionality.

Sidebar: As an aside, I got curious about the distinction between a “working tree” and a “working directory.” A lot of the codebase refers to it as the “working tree,” but I’ve always called it a “working directory” and read through several other tutorials and such over the past few years that call it a “working directory.” As it turns out, there was a recent change in the code base and documentation to shift the terminology from “working directory” to “working tree.” I found a [StackOverflow question](https://stackoverflow.com/questions/39128500/working-tree-vs-working-directory) that brought up a similar question. For those of you who haven’t clicked the link, basically, it was changed from “working directory” to “working tree” to avoid folks confusing the “working directory” with the “current directory.” The “working directory” or “working tree” is the directory that contains the `.git` folder discussed in [this blog post](https://blog.safia.rocks/2018-03-05-whats-inside-the-git-directory/), while the “current working directory” can be any subdirectory within that directory. Don’t worry if this is confusing. Basically, developers are changing what words are used to describe things to avoid confusion.

OK! Sidebar over. Back to the code. That header file I linked to early contains some basic definitions. Take a look at this.

    struct wt_status_change_data {
        int worktree_status;
        int index_status;
        int stagemask;
        int mode_head, mode_index, mode_worktree;
        struct object_id oid_head, oid_index;
        int rename_status;
        int rename_score;
        char *rename_source;
        unsigned dirty_submodule : 2;
        unsigned new_submodule_commits : 1;
    };
    
    enum wt_status_format {
        STATUS_FORMAT_NONE = 0,
        STATUS_FORMAT_LONG,
        STATUS_FORMAT_SHORT,
        STATUS_FORMAT_PORCELAIN,
        STATUS_FORMAT_PORCELAIN_V2,
    
        STATUS_FORMAT_UNSPECIFIED
    };

Above structs and enums store different aspects of the “status” of a directory. Here I noticed things that I can connect with the output from the `git status` command, for example, `rename_status` and `index_status`. The next thing that I did was find all the files where this `wt-status.h` header file was included. Two C files required it. `worktree.c` and `wt-status.c`. After looking at the includes on each of these files, I discovered that `wt-status` contained the code for printing out the status of a directory and `worktree.c` contains the code for checking the status by examining the working tree. So all in all, `wt-status.h` is a header file that includes definitions that are utilized by `worktree.c` and `wt-status.c`. `wt-status.c` relies on the functionality defined for assessing the working tree in `worktree.c`.

Phew! Way too many Cs in that sentence.

Anyways, I started to look into how Git represented the working tree and how it was manipulated. So firstly, there is a related [`worktree.h`](https://github.com/git/git/blob/7668cbc60578f99a4c048f8f8f38787930b8147b/worktree.h) file that contains a definition for a struct that represents the working tree.

    struct worktree {
        char *path;
        char *id;
        char *head_ref; /* NULL if HEAD is broken or detached */
        char *lock_reason; /* internal use */
        struct object_id head_oid;
        int is_detached;
        int is_bare;
        int is_current;
        int lock_reason_valid;
    };

So, a working tree is a path and some details about its refs and state. Next, I started to poke around some of the functions defined in `wt-status.c` to see how they evaluated different aspects of the working trees status. The first thing I was curious about was figuring out how Git determined when you had uncommitted changes in the working tree. As it turns out, this is defined in the nicely named `has_uncommitted_changes` function.

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

It looks like a core bit of the functionality for determining whether a repository has uncommitted changes is done by running a diff on the code base. I’ve made a mental note to look into these diffing functions later. I read through some other functions defined in the source file like `has_unstaged_changes` relied on using diffs to determine if there were changes in the working directory.

There is another class of status-related functions, those that determine whether or not there is a merge or revert in progress.

    struct wt_status_state {
        int merge_in_progress;
        int am_in_progress;
        int am_empty_patch;
        int rebase_in_progress;
        int rebase_interactive_in_progress;
        int cherry_pick_in_progress;
        int bisect_in_progress;
        int revert_in_progress;
        int detached_at;
        char *branch;
        char *onto;
        char *detached_from;
        unsigned char detached_sha1[20];
        unsigned char revert_head_sha1[20];
        unsigned char cherry_pick_head_sha1[20];
    };

This struct contains several binary indicators to dictate the current state of the working directory. I’m curious to know how this state is updated throughout the file.

So I left this exploration with more questions than answers, but such is life. I did figure out a bit more about how the working tree is structured and how its status is determined. Specifically, I leave this exploration with two more questions:

- How does Git execute diffs and how does it manage diffed state?
- How does Git manage the state of the working tree?

Stay tuned for more!

Off to the gym I go…

