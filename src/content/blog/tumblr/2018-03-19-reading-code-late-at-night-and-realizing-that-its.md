---
layout: post
title: Reading code late at night and realizing that it’s not a good idea
date: '2018-03-19T08:49:01-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/172032754710/reading-code-late-at-night-and-realizing-that-its
---
So it’s 11:09 PM on a Sunday night. I’ve been spending the past couple of hours working on implementing a routing table in C for one of my networking classes. It’s the last programming assignment of my college career, which makes me feel some type of way (relieved).

Lucky for you, this blog post isn’t about routing tables! I figured I’d give myself a mental break and look into something else.

In this blog post, I’ll be continuing the series of posts that I’ve been doing about the internals of Git. Over the past few posts, I’ve been trying to answer the question: how does Git know that you have uncommitted changes in a repository?

The relevant chunk of code that I was reading through was the following.

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

In previous posts, I looked into the `rev_info` struct and how Git maintains information about the options of a particular repository. Then I started diving into the `add_head_to_pending` function which looks like this.

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

The function above got me looking into objects as they are used in Git. I explored how they are represented in the filesystem. In this blog post, I want to look into how objects are expressed as a data structure in the Git source code. From the code above, I can see that two relevant struct definitions are worth exploring `object_id` and `object`.

From the digging into the filesystem representation of objects that I did in my last blog post, I have a little bit of an idea of what these two structs might represent. I think `object_id` is a representation of the hash associated with an object and `object` is the metadata associated with the object itself (as defined in previous posts).

But enough hypothesizing, time to investigate! I found the definition of the `object_id` [here](https://github.com/git/git/blob/c6284da4ff4afbde8211efe5d03f3604b1c6b9d6/cache.h#L52-L54).

    struct object_id {
        unsigned char hash[GIT_MAX_RAWSZ];
    };

Aha! As I suspected, the `object_id` struct holds a reference to the hash associated with an object.

OK. The next thing I wanted to look into is the definition of the `object` struct, which I found [here](https://github.com/git/git/blob/7fb6aefd2aaffe66e614f7f7b83e5b7ab16d4806/object.h#L53-L58).

    struct object {
        unsigned parsed : 1;
        unsigned type : TYPE_BITS;
        unsigned flags : FLAG_BITS;
        struct object_id oid;
    };

The `oid` bit makes sense. Each `object` should have a reference to its ID. I was curious to figure out what `parsed` was used for. After some digging, I [discovered](https://github.com/git/git/blob/e83352ef23cca2701953ed3c915f1db49b255a7d/blob.h) the following code comment.

    /**
     * Blobs do not contain references to other objects and do not have
     * structured data that needs parsing. However, code may use the
     * "parsed" bit in the struct object for a blob to determine whether
     * its content has been found to actually be available, so
     * parse_blob_buffer() is used (by object.c) to flag that the object
     * has been read successfully from the database.
     **/

OK! So it seems like one case in which the `parsed` bit can be used is to determine whether or not a blob object has had its file contents properly parsed.

Sidebar: For those who might be unfamiliar with C, the `unsigned parsed: 1` syntax means that `parsed` is an unsigned value that consists of 1 bit. Similarly, the `unsigned type : TYPE_BITS` means that `type` is an unsigned value that consists of 3 bits.

From reading the code comments, I deduced that the `type` field indicates the type of the object (tree, commit, blob, etc.). The `flag` field was a little more complicated to figure out. It consisted of 27 bits. From the code comment below, I could discern that the flags were used in different parts of the codebase for a variety of use cases.

    /*
     * object flag allocation:
     * revision.h: 0---------10 26
     * fetch-pack.c: 0----5
     * walker.c: 0-2
     * upload-pack.c: 4 11----------------19
     * builtin/blame.c: 12-13
     * bisect.c: 16
     * bundle.c: 16
     * http-push.c: 16-----19
     * commit.c: 16-----19
     * sha1_name.c: 20
     * list-objects-filter.c: 21
     * builtin/fsck.c: 0--3
     * builtin/index-pack.c: 2021
     * builtin/pack-objects.c: 20
     * builtin/reflog.c: 10--12
     * builtin/unpack-objects.c: 2021
     */

Yep! That sure is a lot. It looks like this `flags` field is used in everything from commits to pushes to bisections.

OK! So now I feel like I have a solid perspective of what an object is from both a filesystem and data structures perspective. It’s time to look back at this chunk of code.

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

OK! So the `get_oid("HEAD", &oid)` gets the ID of the object associated with the head commit. It’s the equivalent of doing this one the command line.

    $ git cat-file -t HEAD
    commit
    $ git cat-file -p HEAD
    tree f9505fb80cdbdb1081735bf9a824c6bc67081447
    parent 38eea52e57f993d5c594aa7091cc9377b6063f5c
    author Safia Abdalla <safia@safia.rocks> 1520217895 -0600
    committer Safia Abdalla <safia@safia.rocks> 1520217895 -0600
    
    Change #1

So essentially, the first couple of lines in the function get the object associated with the current HEAD (or the most recent commit).

Alright, now the next thing I wanna figure out is what the `add_pending_object` function is doing. It’s almost midnight at this point, and I’m debating whether or not I really want to dive into the code read for yet another function. I did find a piece of documentation that explained what the function did.

    `add_pending_object`::
    
        This function can be used if you want to add commit objects as revision information. You can use the `UNINTERESTING` object flag to indicate if you want to include or exclude the given commit (and commits reachable from the given commit) from the revision list.

I get what this statement is saying, but I also don’t. Ya feel me? I think it might have something to do with the fact that I’ve been up for 18 hours and 75% of them have been reading/writing C code.

What I’m trying to say is, I’m going to end this blog post here. I did learn a couple of interesting things.

- Git objects are uniquely identified by their hashes.
- The type (blob, commit, tree, etc.) of a Git object is stored in a 3-bit unsigned integer.
- Each object has a flag which is used throughout the code base for function-specific details.

To be honest, I’m starting to lose interest in this line of investigation. I think I might have gotten myself too in the weeds and strayed from my original point of inquiry. I’m gonna try and pose a new question to myself to structure my exploration in a different perspective and hopefully get me curious about it again. Specifically, in future posts, I’d like to figure out how a commit is made.

OK, I gotta get to bed…

