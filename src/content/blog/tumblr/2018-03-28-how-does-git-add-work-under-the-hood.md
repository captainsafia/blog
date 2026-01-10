---
layout: post
title: How does `git add` work under the hood?
date: '2018-03-28T09:37:59-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/172344263235/how-does-git-add-work-under-the-hood
---
Over the past couple of blog posts, I’ve been doing a lot of digging into what happens, from a source code perspective, when someone runs `git commit` at the command line. I realized that I should probably look into what happens right before a commit is made when changes are staged. What happens when someone runs `git add` at the command line?

At this point, I’ve read enough of the Git code base to know where to start my investigation. I headed over to the directory where the source code for all the Git command line executables is stored and looked for the code associated with `git add` in [builtin/add.c](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/builtin/add.c).

At this point, I’m feeling like quite the pro around this codebase. I headed straight for the definition of [the `cmd_add` function](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/builtin/add.c#L387).

I wanted to try and structure my code reading process a little differently this time. I’ll admit that prior code explorations were a bit all over the place. I started by reading different chunks of code that were semi-related to each other. Then I started focusing on reading through the data structures associated with a particular problem then reading through the logic associated with it.

In this blog post, I’d like to try another technique. I wanna make a “reduction” of the code that I read. I’d like to take each snippet of code and reduce it back to the pseudocode that would explain its functionality.

The [first couple of lines](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/builtin/add.c#L389-L409) in the `cmd_add` function are pretty straightforward. They are responsible for parsing the arguments that are passed to the `git add` command and responding appropriately. A large portion of this code handles interactive and patch stages. I won’t go into explaining what those are here, but they are wonderful, and you should read more about them [here](https://git-scm.com/book/en/v2/Git-Tools-Interactive-Staging).

So, the first bit of code in the `cmd_add` function can be described using the following pseudocode.

    if the user provided arguments for interactive staging
        invoke the appropriate interactive staging functions

The next couple of lines are responsible for handling different flags that can be passed to the `git add` function. Specifically, the `-A` flag, which indicates that tracked and untracked files should be staged, and `-u`, which indicates that only tracked files should be staged. So the pseudocode for those next few lines can be written as follows.

    if the user passed a -A flag
        stage tracked and untracked files
    if the user passed a -u flag
        stage only tracked files
    if the user passed a -u and -A flag
        freak out because the user should not pass these flags together

There are a few other flags that are handled by I decided to focus on the ones that I use most frequently in my Git workflow.

The next interesting chunk of code was [a couple of lines down](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/builtin/add.c#L464-L478) and was focused on preparing to actually add the files to the index (also known as the staging area). In these lines of code, the paths that are expected to be staged are stored in a temporary data structure.

    for each path the user wants to stage
        for each file in path
            if file has untracked changes
                store it in a temporary list

The files stored in this temporary list are passed to the [`add_files`](https://github.com/git/git/blob/90bbd502d54fe920356fa9278055dc9c9bfe9a56/builtin/add.c#L364) function which is responsible for actually adding each of the files with untracked changes to the index. The moneymaker function here is the `add_to_index` function which is defined [elsewhere](https://github.com/git/git/blob/085f5f95a2723e8f9f4d037c01db5b786355ba49/read-cache.c#L641) in the codebase. I ended up digging around further into the codebase to try and figure out what exactly happens when an untracked change is added to the index. From what I could tell, it all goes back to the [Git objects](https://blog.safia.rocks/2018-03-16-whats-inside-the-gitobjects-directory/) that I explored in [past blog posts](https://blog.safia.rocks/2018-03-19-reading-code-late-at-night-and-realizing-that-its/). Whenever a file is added to an index, a blob object is created, and pathname and the hash of the blob are stored in the index.

The index is stored in a binary file located at `.git/index` within a repository that is version-controlled with Git. This file is binary so cat-ing it won’t get you much. To read this file, you can execute the following command.

    $ git ls-files --stage
    100644 637d210528e696380c88c3beae2a695f574c3c74 0 test.txt

As you can see, it contains the filename, the hash of the object, and the permissions on the object. If we examine the object referenced above, we can see that it is a blob that contains the contents of the file that was staged.

    $ git cat-file -t 637d210528e696380c88c3beae2a695f574c3c74
    blob
    $ git cat-file -p 637d210528e696380c88c3beae2a695f574c3c74
    Some content.

And that’s that! There’s obviously way more details on this, but this gives you a pretty good sense of what is going on. It also enforces the general concept around how Git is implemented that I clarified in [my last blog post](https://blog.safia.rocks/2018-03-26-a-complete-story-of-what-happens-when-you-run-git/).

Essentially, filesystem artifacts persist data that is represented by data structures stored as C structs in the code. Staging a file for commit involves recognizing the changes in the filesystem and mapping those changes into representations that are recognized by C through the data structures and filesystem artifacts mentioned above.

Dare I say, this actually makes a lot of sense and is pretty trivial to understand/mimic. Git just got a whole lot less intimidating now that I know what is going on under the hood.

There’s a sense of finality to the sentences above because I feel like I’ve figured out most of what is interesting to figure out about Git. Another code base has caught my interested, but I’ll dive more into that in my next blog post. Until then, thanks for reading!

