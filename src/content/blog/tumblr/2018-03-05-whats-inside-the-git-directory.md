---
layout: post
title: What’s inside the .git directory?
date: '2018-03-05T10:01:10-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/171558325240/whats-inside-the-git-directory
---
So, in [my last blog post](https://blog.safia.rocks/2018-03-02-getting-into-git-init/), I got a little bit into figuring out how `git init` works. The central point of the functions associated with `git init` was creating the files that are stored in the `.git` directory. I figured that the logical next step is to take a look at what kinds of things are inside the `.git` directory and figure out what they are required for. To do this, I started by initializing Git inside an empty directory.

    $ ls -lFh .git/
    total 24
    -rw-r--r-- 1 captainsafia staff 23B Mar 4 20:30 HEAD
    drwxr-xr-x 2 captainsafia staff 64B Mar 4 20:30 branches/
    -rw-r--r-- 1 captainsafia staff 137B Mar 4 20:30 config
    -rw-r--r-- 1 captainsafia staff 73B Mar 4 20:30 description
    drwxr-xr-x 12 captainsafia staff 384B Mar 4 20:30 hooks/
    drwxr-xr-x 3 captainsafia staff 96B Mar 4 20:30 info/
    drwxr-xr-x 4 captainsafia staff 128B Mar 4 20:30 objects/
    drwxr-xr-x 4 captainsafia staff 128B Mar 4 20:30 refs/

I set up the `ls` statement above so that you can easily see which objects are directories and which are files. Let’s start at the top, shall we? What’s in HEAD?

    $ cat .git/HEAD
    ref: refs/heads/master

Oh, interesting! So it looks like it stores the reference to the current branch we are on. So assuming this is true if I check out a new branch, the contents of HEAD should change.

    $ git checkout -b new-branch
    $ cat .git/HEAD
    ref: refs/heads/new-branch

So the next thing to look at would be the `branches/` directory, but I find myself more intrigued by the `refs/` directory since it was referenced in the HEAD file above. What can we find in there?

    $ ls .git/refs
    heads tags
    $ ls .git/refs/heads

So the `refs/` directory contains the `heads/` and `tags/` directories. However, the `refs/heads` directory doesn’t contain anything. I think this is because I haven’t committed anything yet so there isn’t really a commit to reference here. So, I assume that if I create a commit, the `refs/heads/master` file should be populated.

    $ touch test.txt
    $ git add test.txt
    $ git commit -m "Initial commit"
    [new-thing (root-commit) 38eea52] Initial commit
     1 file changed, 0 insertions(+), 0 deletions(-)
     create mode 100644 test.txt
    $ ls .git/refs/heads
    new-thing
    $ cat .git/refs/heads/new-thing
    38eea52e57f993d5c594aa7091cc9377b6063f5c

OK! That makes sense. I created a file and committed to the `new-thing` branch. Shortly after that, a `refs/heads/new-thing` file was located, and its contents consisted of the commit hash of the commit that I just made. This makes sense. What happens if I make another commit?

    $ echo "Some content." >> test.txt
    $ git add test.txt
    $ git commit -m "Change #1"
    [new-thing 63916e1] Change #1
     1 file changed, 1 insertion(+)
    $ cat .git/refs/heads/new-thing
    63916e1e1856e84d1f26dc9e0c26ec5b2344b991

What happens if I go back to the older commit?

    $ git checkout 38eea52
    $ cat .git/refs/heads/new-thing 
    63916e1e1856e84d1f26dc9e0c26ec5b2344b991
    $ cat .git/HEAD 
    38eea52e57f993d5c594aa7091cc9377b6063f5c

So, when I check out the older commit, I enter detached HEAD mode. In this state, the head reference on the `new-thing` branch still points to the latest commit but the HEAD file points to the commit hash associated with our initial commit. This makes sense because when we are in the detached HEAD mode, we technically aren’t in the `new-thing` branch, so it doesn’t make sense to have HEAD reference it.

Speaking of which, what’s inside the `branches/` directory?

    $ ls -lFh .git/branches/

Hm. Nothing. That surprised me! I expected there to be some sort of reference to the `new-thing` or `master` branches. Some Googling [revealed](http://schacon.github.io/git/gitrepository-layout.html) that these `branches/` directory is actually a presently-deprecated way to store references to URLs that are used in commands like `git pull` and `git push`.

The next thing on the list is the `config` file. I’ve tinkered around with this configuration file before, so I’m familiar with its innards. For those unfamiliar, the file looks a little something like this.

    $ cat .git/config 
    [core]
            repositoryformatversion = 0
            filemode = true
            bare = false
            logallrefupdates = true
            ignorecase = true
            precomposeunicode = true

I think I’ll probably do another blog post where I look at all the possible ways that you can configure this file in more details. For now, I’ll try my best to keep my focus on the `.git` directory. Harharhar!

The next object on the list is the `description` file. What’s in there?

    $ cat .git/description 
    Unnamed repository; edit this file 'description' to name the repository.

Hm. Interesting. It states the repository is unnamed. I would expect the name of the repository to be the name of the directory I am working in (`git-test`), but that is not the case. I did some Googling, and it turns out that this particular file is used by the GitWeb program (it’s like GitHub, except it’s not GitHub). This web application uses the data stored in the ‘description’ file.

I’m also a little familiar with the purpose of the next object on the list, the `hooks/` directory. Usually, I will use it to configure a post-commit hook that will run the Prettier code formatter.

    $ ls .git/hooks/
    applypatch-msg.sample post-update.sample pre-commit.sample pre-rebase.sample prepare-commit-msg.sample
    commit-msg.sample pre-applypatch.sample pre-push.sample pre-receive.sample update.sample

By default, the directory contains some sample files that showcase how you can use hooks. Hooks are basically just shell scripts, so you would program them the same you code any other shell script.

The next directory in the list is the `info/` directory. What’s in that directory?

    $ ls .git/info/
    exclude

Interesting. What’s in the `exclude` file?

    $ cat .git/info/exclude 
    # git ls-files --others --exclude-from=.git/info/exclude
    # Lines that start with '#' are comments.
    # For a project mostly in C, the following would be a good set of
    # exclude patterns (uncomment them if you want to use them):
    # *.[oa]
    # *~

So it looks like the exclude file, which is aptly-named, contains a list of some files that you are likely to want to exclude when running certain Git commands.

The last directory in the list is the `objects` directory. I discovered how this directory was initialized in my last blog post, but let’s check out what’s in it now.

    $ ls .git/objects/
    38 5e 63 e6 f9 info pack

So, from looking at some of the subdirectories in the `objects/` file, I can see that they are clearly references to the commit hashes of the commits that were made. This brings up a pretty important question, in my opinion. What exactly is an object? I’m gonna be a little lazy here and just [link](https://matthew-brett.github.io/curious-git/git_object_types.html) y'all to a good article that I found that explains the contents of the `.git/objects` directory in full.

So that exploration was pretty interesting. I definitely feel much more confident about the content of the `.git` directory. I also have a couple more questions to answer.

- What are the options available in the `.git/config` file?
- How is the hierarchy of subdirectories in `.git/objects` created?
- How are the scripts in the `hooks` directory integrated into Git’s command?

Until next time!

