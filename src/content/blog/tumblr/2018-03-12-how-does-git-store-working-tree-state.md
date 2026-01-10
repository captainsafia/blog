---
layout: post
title: How does Git store working tree state?
date: '2018-03-12T09:30:43-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/171796245560/how-does-git-store-working-tree-state
---
In [my last blog post](https://blog.safia.rocks/2018-03-09-trying-to-figure-out-how-git-status-works-a-saga/), I started digging into how `git-status` works. I ended up going into a little bit of a rabbit hole. As it turns out, the `git-status` command intersects with the Git differ and the way that state about the current working tree is managed. I ended up setting aside two specific questions to answer in my blog post.

- How does Git execute diffs and how does it manage diffed state?
- How does Git manage the state of the working tree?

In today’s blog post, I’d like to take a stab at answering the second question more thoroughly. I already figured that Git uses a `wt_status_state` struct (a data structure in C) to store information about whether or not the working tree is in the middle of a merge or a revert or other things. To be more specific, here are the different fields defined in the struct.

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

Neat, right? So I poked around the code to try and figure out where this wt\_status\_state object was populated in the code base. Most of this logic is stored in the [`wt_status_get_state`](https://github.com/git/git/blob/d0db9edba0050ada6f6eac68061599690d2a4333/wt-status.c#L1541) function. Here’s what the header for that function looks like.

    void wt_status_get_state(struct wt_status_state *state,
                 int get_detached_from)

Like most C functions, you give it a pointer to an object that it should populate with information (`*state`) and some additional information. So how is the `wt_status_state` struct populated? The first meaningful line of code in the function does this.

    if (!stat(git_path_merge_head(), &st)) {
        state->merge_in_progress = 1;
    }

Interesting! So the `stat` function is a function that returns information about the status of a file. You can read more about it [here](http://man7.org/linux/man-pages/man2/stat.2.html). So, whatever the `git_path_merge_head` function returns, it must be some sort of file path. I decided to see where and how this function was defined. As it turns out, the function isn’t defined explicitly. Instead, the function is invoked using a macro definition, as below.

    #define GIT_PATH_FUNC(func, filename) \
        const char *func(void) \
        { \
            static char *ret; \
            if (!ret) \
                ret = git_pathdup(filename); \
            return ret; \
        }

So, basically, whenever we call `git_path_merge_head`, what is really invoked is the following snippet of code.

    const char *git_path_merge_head(void) {
        static char *ret;
        if (!ret)
            ret = git_pathdup("MERGE_HEAD");
           return ret;
    }

In this case, the `git_pathdup` function returns the location of the `.git` directory of the repository that we are in (this would be something like `~/dev/my-git-repo/.git`) concatenated with the defined filename (so the result of invoking the function above on the sample path would be `~/dev/my-git-repo/.git/MERGE_HEAD`).

OK! Now that we know what the `git_path_merge_head` function does, we can go back and look at the code in `wt_status_get_state` is doing.

    if (!stat(git_path_merge_head(), &st)) {
        state->merge_in_progress = 1;
    }

So, `stat` returns a false-y value if it can’t find the file located at the path returned by `git_path_merge_head`. In essence, this snippet of code checks to see if a `MERGE_HEAD` file exists in the `.git` directory and sets the state of `merge_in_progress` to a truthy value if that is the case.

The code for checking to see if the user is currently cherry-picking the working tree is the same.

    else if (!stat(git_path_cherry_pick_head(), &st) &&
             !get_oid("CHERRY_PICK_HEAD", &oid)) {
        state->cherry_pick_in_progress = 1;
        hashcpy(state->cherry_pick_head_sha1, oid.hash);
    }

And so is the code for checking to see if the working tree is currently being reverted.

    if (!stat(git_path_revert_head(), &st) &&
        !get_oid("REVERT_HEAD", &oid)) {
        state->revert_in_progress = 1;
        hashcpy(state->revert_head_sha1, oid.hash);
    }

Aha! So under the hood, the state of the working tree is actually stored on the filesystem through a collection of specially named files in the `.git` directory. There was one condition that was different though.

    } else if (wt_status_check_rebase(NULL, state)) {
        ; /* all set */
    }

Hm. Why does the check for a working tree in the middle of a rebase look like this? As it turns out, in the definition of the [`wt_status_check_rebase`](https://github.com/git/git/blob/d0db9edba0050ada6f6eac68061599690d2a4333/wt-status.c#L1501) function, Git checks to see if certain rebase-related files (`rebase-apply`) exist in the working directory. So although the function call for checking if a rebase is in progress looks different, under the hood, it is doing the same thing. It checks to see if specific files exist in the working tree that reflect the state of the repository.

Well! I’m glad I got that answer settled. To be honest, I’ve seen these `MERGE_HEAD` and `REVERT_HEAD` files in my Git repository before. I figured that Git used them to store some information about the merge state, but it’s cool to have a more specific perspective on one way these files are used.

Alright. Catch you next time!

