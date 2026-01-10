---
layout: post
title: Learning more about how commits are represented in Git
date: '2018-03-23T09:43:49-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/172170673860/learning-more-about-how-commits-are-represented-in
---
So in my [last code-reading blog post](https://blog.safia.rocks/2018-03-19-reading-code-late-at-night-and-realizing-that-its/), I decided to realign my exploration of the Git codebase and try to figure out how a commit is made. Essentially, I wanted to know what is going on under the hood when I type `git commit`.

Sidebar: I feel like I should start calling this series of posts “Code Reading Rainbow.” Yep, I’m making this a thing.

OK, back to the main point of this blog post.

I poked around the Git codebase and discovered that a lot of the interesting code related to commits is located in [this C header file](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/commit.h) and [this C source file](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/commit.c). One of the first things that I like to do when reading the Git codebase is explore some of the data structures that are associated with a particular bit of code. In fact, as I scroll through the code base and pick out all the `struct`s defined in the header file linked above, I think I might spend this entire blog post looking into just that.

I started off with the most important struct, the `commit` struct. Its definition looks like this.

    struct commit {
    
    struct object object;
    
    void *util;
    
    unsigned int index;
    
    timestamp_t date;
    
    struct commit_list *parents;
    
    struct tree *tree;
    
    };

OK! So there are a couple of things that I can easily pick out from this based on my own knowledge and code I have read before. The `object` struct referenced is the object associated with this particular commit. I learned about Git objects and blogged about it [here](https://blog.safia.rocks/2018-03-16-whats-inside-the-gitobjects-directory/) and [here](https://blog.safia.rocks/2018-03-19-reading-code-late-at-night-and-realizing-that-its/). The date is (obviously) the time that a certain commit was made.

I had to dig a little further into the other attributes in the struct. The easiest one to parse seemed to be the `parents` because it referenced another struct defined in the same header file.

    struct commit_list {
    
    struct commit *item;
    
    struct commit_list *next;
    
    };

OK! This is pretty easy to grasp. The `parents` attribute is a linked-list-like data structure of all the commits made before the commit that was just created.

The next thing that intrigued my interest was the `void *util` pointer. For those of you who are not familiar with C, a `void*` represents the definition of a void pointer. It’s essentially a pointer that can point to an object of any type. In this case, `util` can be an `int` or `short` or `char`. The undefined nature of this attribute made me curious. What could this `util` pointer possibly be? I decided to jump over to the source file and see where the `util` pointer was utilized to determine if I could figure out its purpose.

The most illuminating snippet of code was the following.

    void set_merge_remote_desc(struct commit *commit,
    
    const char *name, struct object *obj)
    
    {
    
    struct merge_remote_desc *desc;
    
    FLEX_ALLOC_STR(desc, name, name);
    
    desc->obj = obj;
    
    commit->util = desc;
    
    }

So, it looks like the `util` pointer is a pointer to a `merge_remote_desc` struct. The `merge_remote_desc` struct is defined as follows.

    struct merge_remote_desc {
    
    struct object *obj; /* the named object, could be a tag */
    
    char name[FLEX_ARRAY];
    
    };

It looks like the `merge_remote_desc` object contains references to a Git object that has a name associated with it. As mentioned in previous blog posts, a Git object can either a commit, a tree, a blob, or a tag. So it looks like you can ultimately associated a commit with a tag (and then name that association).

The next ambiguous attribute in the `commit` struct that caught my attention was the `unsigned int index` attribute. I tried to find a reference to the `index` attribute in the source file, but I couldn’t find anything that was particularly illuminating. So I could clarify what is confusing me about this particular bit, the “index” in Git is the staging area, this is where modified files are added before being associated with a commit. I’m confused as to why a potential reference to this index would be stored as an `unsigned int`.

I poked into the source file to see if I could find any references to the `index` attribute that might illuminate why it was typed this way but couldn’t come up with anything. At this point, I figured that the type `unsigned int` might indicate that although it is named `index`, it has nothing to do with the Git-staging-area-index and is instead a reference to a position in some sort of list. One idea that I had is that the `index` attribute might be a reference to a particular commit’s position in the list of commits that are defined above. I can’t find any explicit evidence of this so I’ll just bookmark this particular line of questioning as something to look into further as I read more of the Git code base.

The last remaining attribute in the `commit` struct is the `tree` attribute. The `tree` attribute is a representation of a `tree` struct which is defined like this.

    struct tree {
    
    struct object object;
    
    void *buffer;
    
    unsigned long size;
    
    };

As I learned through previous code reads, a Git tree consists of references to multiple blobs or other trees. It’s a way of storing files that are associated with each other in a single object. It’s analogous to think of it as a filesystem directory (ish). So this attribute stores a reference to the collection of blobs that are associated with a particular commit.

I didn’t dive into all of the source code associated with committing in Git, but the short reads that I did dive into illuminated a lot about how commit objects are manipulated and how manipulations of the data structure are reflected in data that is stored in the filesystem.

I’ll dive into that more in the next code read. Until then, I’ll be mulling over what I discovered while writing up this post.

