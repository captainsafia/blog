---
layout: post
title: What’s inside the `.git/objects` directory?
date: '2018-03-16T10:00:45-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/171932025970/whats-inside-the-gitobjects-directory
---
OK! So I am continuing this Git series. I should probably make a tag or something for it at this point, but you can just see the other posts related to this topic by going through my archives.

In [my last blog post](https://blog.safia.rocks/2018-03-14-how-does-git-know-if-you-have-uncommitted-changes/), I started looking into how Git determines whether or not you have uncommitted changes in the working tree. That code read didn’t end up answering a ton of questions, but it ended up bringing up more focused and refined questions so yay! I left the last post with the following questions.

- What does `init_grep_defaults` do?
- What is an object from a filesystem perspective and a data structure perspective?
- What does it mean to add an object to HEAD?
- Why is the `rev_info` struct so damn dense?

So, I wanna start focusing on answering the second question in this blog post. If you want the backstory on this question, you can go back and read the last post that is linked above.

Anyways, on to the main topic of this post: objects.

So in [one of my earlier blog posts](https://blog.safia.rocks/2018-03-05-whats-inside-the-git-directory/) (the one about the `.git` directory), I touched into objects as a filesystem artifact related to Git. I wanna dive into this and how it is used in the Git codebase a little bit more. So, from a filesystem perspective, objects are stored in the following location within the `.git` directory.

    $ ls .git/objects/
    38 5e 63 e6 f9 info pack

When I first started exploring this directory, I was pretty intrigued by the association between the folders and objects in this directory and the commit hashes in the project. So, if we look at the commits for this project.

    $ git log
    commit 63916e1e1856e84d1f26dc9e0c26ec5b2344b991 (HEAD -> new-thing)
    Author: Safia Abdalla <safia@safia.rocks>
    Date: Sun Mar 4 20:44:55 2018 -0600
    
        Change #1
    
    commit 38eea52e57f993d5c594aa7091cc9377b6063f5c
    Author: Safia Abdalla <safia@safia.rocks>
    Date: Sun Mar 4 20:42:03 2018 -0600
    
        Initial commit

You’ll notice that some of the folders in the objects directory correspond with the first two digits of the commit hashes per the log. OK. All these ideas are a bit informal at the moment. It’s time to get a little bit more rigorous about this.

Today, I’m gonna do something I don’t often do in these code reads. I’m gonna read the documentation before I read the code. This is mostly because I want to read something that will give me the knowledge to structure future explorations. It makes the blog less interesting to read, but such is life.

So, I went to the most authoritative guide that I could find on Git objects, the [documentation](https://git-scm.com/book/id/v2/Git-Internals-Git-Objects) from the official Git book. You can go and read it now, or you can read this handy summary I made below.

- The entire objects directory is a representation of a filesystem-based key-value store. The key is the hash (that’s the thing that ends up forming the directory), and the contents are described in the bullet points below depending on the type of object.
- Objects can either be associated with a commit, a blob, a tag, or a tree.
- A commit object contains all the information you might expect to be associated with a commit (hash, author, timestamp).
- A blob object contains a hash of the contents of a file at a certain point.
- A tag object usually contains the same information as a commit object (hash, author, etc.) since a tag is generally a reference to a specific commit.
- A tree is an object that stores references to blobs. Addendum: I just learned they can also store references to trees too.
- There is a collection of git commands that can be used to read objects inside the `.git/objects` directory like `git cat-file` and `git hash-object`.

So I decided to play around with these commands to figure out what is going on here. Can I use the `git cat-file` command to get the blob of the file associated with the change I made in the initial commit made above?

    $ git cat-file -p 38eea52e57f993d5c594aa7091cc9377b6063f5c
    tree 5efb9bc29c482e023e40e0a2b3b7e49cec842034
    author Safia Abdalla <safia@safia.rocks> 1520217723 -0600
    committer Safia Abdalla <safia@safia.rocks> 1520217723 -0600
    
    Initial commit

Neat-o! So the contents of that particular commit contain the information I expected to see. It’s the committer and the timestamp and the commit message. From the above, it looks like there is a tree object associated with this commit object.

    $ git cat-file -p 5efb9bc29c482e023e40e0a2b3b7e49cec842034
    100644 blob e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 test.txt

OK! So I’ve just read the data associated with the commit object and tree object for a single commit. But how do I get the actual blob referenced in the output above?

    $ git cat-file -p e69de29bb2d1d6434b8b29ae775ad8c2e48c5391

Hm. Nothing. That’s not what I was expecting. I ended up messing around with this for a while until I realized something totally idiotic. In my initial commit, I had committed an empty file. So, of course, the contents of the blog were empty.

To actually see this all the way through, I needed to investigate the commit with the message “Change #1” from the commit log above.

    $ git cat-file -p 63916e1e1856e84d1f26dc9e0c26ec5b2344b991
    tree f9505fb80cdbdb1081735bf9a824c6bc67081447
    parent 38eea52e57f993d5c594aa7091cc9377b6063f5c
    author Safia Abdalla <safia@safia.rocks> 1520217895 -0600
    committer Safia Abdalla <safia@safia.rocks> 1520217895 -0600
    
    Change #1
    $ git cat-file -p f9505fb80cdbdb1081735bf9a824c6bc67081447
    100644 blob 637d210528e696380c88c3beae2a695f574c3c74 test.txt
    $ git cat-file -p 637d210528e696380c88c3beae2a695f574c3c74
    Some content.

That’s more like it! I’m sorry for doubting you, Great Computer! I am but a foolish human…

OK! So that’s neat. It’s kinda cool to be able to look into the different objects in the `.git/directory` and track how different aspects of a commit are represented.

I feel like I should end this blog post here. I think I’ve got a pretty solid idea on the purpose of Git objects from a filesystem perspective and am well-equipped to look into them from a code base/data structure perspective in some future blog post.

See ya around!

