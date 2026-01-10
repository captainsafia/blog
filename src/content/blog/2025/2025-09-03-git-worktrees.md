---
title: Git worktrees for fun and profit
tags: [git, development-workflow, version-control]
---

I've always been a mental multi-tasker when it comes to juggling the things I'm working on. I like having multiple bugs and features in flight at the same time and bouncing between different ideas. Prior to learning about git worktrees, maintaining multiple clones of a repo was my way of managing my multi-tasker workflow. This got really hard to do as my career progressed and I started juggling not just multiple features and bugs — but multiple prototypes and code reviews. About a year ago, I finally decided enough was enough and I needed to invest some energy into my source control workflow so that managing all these different workstreams was somewhat sane. Enter: git worktrees.

Git worktrees allow you to check out multiple branches from a repo at a time, each isolated in its own directory, and all sharing the same Git repository. This has some space-saving benefits (there's only one `.git` directory for multiple branches) and some hygiene benefits (no juggling stashes or checkouts between branches). In my workflow, I like to pair git worktrees with another Git feature to maximize structure: bare clones.

Bare clones are initiated by running `git clone --bare $REPO_URL` and effectively create a clone that contains only the repo's `.git` directory and no actual source code. If you couple them with Git worktrees, you can get a nice workflow where one directory contains just the `.git` repository and other directories contain actual source code that's been checked out.

To structure things in my workflow, I create a parent directory that will contain the bare clone and any worktrees.

```
$ mkdir aspire
$ cd aspire
$ git clone --bare https://github.com/dotnet/aspire.git
$ ls
aspire.git
```

In this case, `aspire.git` contains only the git repository. To checkout the actual source code from the main branch:

```
$ cd aspire.git
$ git worktree add ../main
```

This creates a sibling directory to `aspire.git` that contains source code that can be built/debugged/etc. And that forms the basis of my workflow. Each repo gets its own directory with a bare clone and sibling directories containing the Git worktrees.

Some things to note about worktrees and bare clones:
- They're a relatively niche feature so not all tools support them. In fact, it was only in the July 2025 edition of VS Code that the popular code editor finally received first-class support for worktrees in its git integration ([ref](https://code.visualstudio.com/updates/v1_103#_git-worktree-support))
- Although you get the benefits of a single Git repository per repo, the files in each worktree still take up space so it is helpful to prune them every now and then.
- The bare clone is the central git repository and the source of truth for all config. If you need to modify any behavior of the git repository, you'll need to modify the `config` in the bare clone.
If all these issues seem pretty mild, I’ll bring your attention to one that really tripped me up when I first setting up this workflow. The issue with is that upstreams aren't automatically configured for worktrees created from a branch on a remote. In the worktree created above, we’ll see:

```
$ git rev-parse --abbrev-ref --symbolic-full-name @{u}
fatal: no upstream configured for branch 'main'
```
This means that keeping your local worktree-based branch in sync with a remote can become difficult. If we try to set the remote with the usual commands, we’ll see:
```
$ git branch -u origin/main
fatal: the requested upstream branch 'origin/main' does not exist
```
To fix this issue, we need to configure the bare clone to properly fetch remote branches. By default, bare clones don't set up the standard refspec that maps remote branches to local remote-tracking branches. We can do this by running the following command to fetch the correct refspecs for the “origin” remote.
```
$ git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
```
This tells Git to fetch all branches from the remote and create corresponding remote-tracking branches under `refs/remotes/origin/`. The `+` prefix allows non-fast-forward updates.
Next, we can fetch the remote branches to populate the remote-tracking branches:
```
$ git fetch origin
```

Now, we can see the remote-tracking branches:
```
$ git branch -r
  origin/main
  origin/feature-branch
```

Add set up upstream tracking for the other 
```
$ git branch -u origin/main
Branch 'main' set up to track 'origin/main'.
```

At this point, you can use standard Git commands like `git pull`, `git push`, and `git status` will show you whether your branch is ahead, behind, or in sync with the remote.

For new worktrees created from remote branches, you can now use the `-t` flag to automatically set up tracking:
```
$ git worktree add -t ../feature-work origin/feature-branch
```

This creates a new worktree and automatically configures it to track the remote branch, so now we can pull/push from and to the tracking branch the same way we would from a non-worktree based setup. Nice!