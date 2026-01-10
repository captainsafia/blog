---
layout: post
title: A complete story of what happens when you run `git commit`
date: '2018-03-26T09:06:31-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/172273926295/a-complete-story-of-what-happens-when-you-run-git
---
So, in [my last blog post](https://blog.safia.rocks/2018-03-23-learning-more-about-how-commits-are-represented-in/), I looked into the data structures used to represent commits in the Git code base. In this blog post, I’d like to look a little bit more into what actually happens when you run `git commit` inside a Git repository.

As mentioned in my previous blog post, most of the heavy lifting done concerning committing is located in the aptly-named [commit.c](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/commit.c) source file.

I started poking around the code to try to find the entry point for the `git commit` command. I discovered that although a lot of the core logic for manipulating commits is stored in the commit.c file, a lot of the code that is executed when you run `git commit` is stored in the [builtin/commit.c](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/builtin/commit.c) source file. Specifically, the code for the `commit` command is located at [these lines](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/builtin/commit.c#L1404-L1632). It is a total of 200-ish lines of code, so I decided to extract the calls that were made from the command line executable to the supporting library in chronological (based on how early they are called in the function) order. The commit-related functions that are invoked are as follows.

1. `lookup_commit_or_die`
2. `parse_commit`
3. `prepare_to_commit` (This is not actually defined in `commit.c`, but it’s important so I’m including it here.)
4. `copy_commit_list`
5. `commit_list_append`
6. `commit_list_insert`
7. `commit_tree_extended`

This list is brief, but the story it tells is generally as follows. First, we look up the existing commit that is on the current branch. This commit is going to be the parent of the new commit we make. Then we prepare to make the commit by doing things like checking the information of the new commit’s author and prompting the user for a commit message. Then, the commit object is actually written to the `.git/objects` directory through the `commit_tree_extended` function. The `commit_list` associated function calls are invoked if the commit being executed is a merge commit, in which case, the commit list is automatically updated to make the merge commit at the head of the commit list.

With this in mind, I now know that the two most important functions invoked in the code above are the `prepare_to_commit` and `commit_tree_extended` function. I decided to look into those a little bit further. It makes sense to start looking through the `prepare_to_commit` function first, so I’ll begin there. You can follow along at [this function declaration](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/builtin/commit.c#L627) if you would like.

I started to skim through the code in the `prepare_to_commit` function. It starts by doing things like verifying the author’s info.

    /* This checks and barfs if author is badly specified */
    determine_author_info(author_ident);

And running any pre-commit hooks that are included in the Git repository.

    if (!no_verify && run_commit_hook(use_editor, index_file, "pre-commit", NULL))
        return 0;

The next couple of lines, well more than a couple, are related to requesting the commit message from the user and creating a complete commit message with the commit date and commit author.

I was actually quite surprised to see that the code associated with making a commit message was so involved. It turns out that it handles the code for a quite a few cases. For example, you have to treat commit messages differently depending on whether you are doing a merge commit or a cherry pick commit.

The next thing that I wanted to dig into was the `commit_tree_extended` function which is defined [here](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/commit.c#L1510).

I read through the code defined for this function and realized that it was mostly responsible for processing the information stored in the commit message and writing it into the commit object that I learned more about a few blog posts back. That object looks something like this.

    $ git cat-file -p 38eea52e57f993d5c594aa7091cc9377b6063f5c
    tree 5efb9bc29c482e023e40e0a2b3b7e49cec842034
    author Safia Abdalla <safia@safia.rocks> 1520217723 -0600
    committer Safia Abdalla <safia@safia.rocks> 1520217723 -0600
    
    Initial commit

So, all in all, based on my understanding of the code that I just read, this is what I discern happens when you run `git commit` inside a Git repository.

1. The `cmd_commit` function in `builtin/commit.c` is invoked.
2. The `cmd_commit` function calls `prepare_to_commit` which requests the commit message from the user and prepares the data associated with the commit (like the author’s info and the current time).
3. The `commit_tree_extended` function is called with the commit message data that was collected in the prior step. This data is written to a buffer, and the buffer is then written to the `.git/objects` directory as a COMMIT object.

This is a rough overview of what is going on. There is a lot more detail, mostly related to handling “edge cases” like merge commits. I feel pretty good about the connections between the commit data structure used in the Git code base, the commit object that is persisted to the filesystem, and the commit message information that is collected from the user.

Essentially, whenever a new commit is going to be made, the following happens.

1. A commit object is created in memory. This is represented as a `commit` struct.
2. The commit struct is populated with information about the time of the commit and the author of the commit.
3. A commit message is collected from the user.
4. The data from the commit message and the data stored in the commit struct is written to a commit object which is stored in the filesystem.

As per usual, this is what I think is happening based on what I’ve read from the code. I might be a little bit off in some places. If so, let me know by sending me an email at safia [at] safia [dot] rocks.

Until next time!

