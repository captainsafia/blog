---
layout: post
title: What’s in a git config?
date: '2018-03-07T08:30:26-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/171624930481/whats-in-a-git-config
---
So over the past couple of days, I’ve been enjoying digging into the Git codebase and Git internals. I share my posts on Twitter and for the most part (thankfully!) people enjoy them. Recently, someone commented on [my last blog post](https://blog.safia.rocks/2018-03-05-whats-inside-the-git-directory/), that I could’ve just read the docs to answer my questions instead of going around exploring the codebase and configuration files. I figure this would be a good chance to highlight why I’ve been writing these blog posts.

1. I’m trying to be a better writer.
2. I find that I retain knowledge better when I associate it with experience.
3. I like it!

So yes, it’s definitely possible to just read the docs or ask a maintainer or expert for answers to a lot of the things I’m exploring. I, personally, find that having to work a little “harder” to learn something helps me retain the information better.

So yeah, that’s that. Now to the main point of this blog post, Git.

In my last blog post (linked above), I explored the contents of the `.git` directory and discovered that there was a `config` file inside the `.git` directory whose contents look like this.

    [core]
        repositoryformatversion = 0
        filemode = true
        bare = false
        logallrefupdates = true
        ignorecase = true
        precomposeunicode = true

Per my commentary above, I’m gonna learn about what these configuration parameters might be responsible for buying reading the code. And hopefully, along the way, I’ll learn even more about Git.

The first configuration key above, `respositoryformatversion`, makes an appearance in the `init-db.c` file that I looked into in my [blog post on Git init](https://blog.safia.rocks/2018-03-02-getting-into-git-init/).

    xsnprintf(repo_version_string, sizeof(repo_version_string),
    243 "%d", GIT_REPO_VERSION);
    git_config_set("core.repositoryformatversion", repo_version_string);

This portion of the code base sets the default value of `repositoryformatversion` to “0” as seen in the above configuration. Where else it is referenced? In [another portion](https://github.com/git/git/blob/b2e45c695d09f6a31ce09347ae0a5d2cdfe9dd4e/list-objects-filter-options.c#L128) of the code base, it is set to a value of “1.”

    git_config_set("core.repositoryformatversion", "1");

From reading through the codebase, I figured out that the value of `repositoryformatversion` is binary. Whenever it is referenced, it is either compared to 0 or 1. Note: This comparison wasn’t your usual “check if a function returns 0 to signify success” check that you see in C codebases. The next thing I did to figure out what this configuration was responsible for was looking through the commit history on Git. Perchance, I found [this beautiful commit](https://github.com/git/git/commit/00a09d57eb8a041e6a6b0470c53533719c049bab), and I mean truly beautiful, that elaborated on the purpose of the difference `repositoryformatversion` values. As it turns out, the different version values of `repositoryformatversion` exist to signify whether or not a repository supports extensions to Git’s normal functionality. The commit message references situations where a user might want to utilize a different format for the `refs` directories that I explored in my last blog post. Neat-o!

Alright! Next up is this little `filemode` configuration option. The most interesting references I found to this configuration option in the codebase were [in `config.c`](https://github.com/git/git/blob/b2e45c695d09f6a31ce09347ae0a5d2cdfe9dd4e/config.c#L1006-L1009).

    if (!strcmp(var, "core.filemode")) {
        trust_executable_bit = git_config_bool(var, value);
        return 0;
    }

Interesting! So if the value of `core.filemode` is set to true, then the value `trust_executable_bit` is set to true and vice versa. But what exactly is an executable bit? I’ll confess that at some point I learned about this from a professor in a computer science lecture but I’m quite forgetful, so I’ll have to look at it again. I have a foggy recall of what it is but here’s a clearer definition from newer research.

An executable bit is a permission bit set in directories and files stored in Linux. Since you can change the permissions of files in Linux, you can change the underlying executable bit. So main gist: an executable bit is just a way of setting permissions on a file.

After reading some more code, specifically some of the code in the [`cache.h`](https://github.com/git/git/blob/c6284da4ff4afbde8211efe5d03f3604b1c6b9d6/cache.h#L265-L274), I learned that setting `filemode` to “false” will prevent Git from detecting changes to permissions (and the underlying bits) as changes to the actual file. I decided to test this out. I changed the permissions on one of the files in a Git directory. Check this out.

    $ git status
    On branch new-thing
    nothing to commit, working tree clean
    $ chmod +x test.txt 
    $ git status
    On branch new-thing
    Changes not staged for commit:
      (use "git add <file>..." to update what will be committed)
      (use "git checkout -- <file>..." to discard changes in working directory)
    
            modified: test.txt
    
    no changes added to commit (use "git add" and/or "git commit -a")

Now, what happens if I set `filemode` to “false”?

    $ vim .git/config # This is where I changed the filemode value 
    $ git status
    On branch new-thing
    nothing to commit, working tree clean

Way cool! I’m actually genuinely excited by this discovery because it seems like a super practical thing to know.

OK! The next config parameter is the `bare` parameter. It’s presently set to “false.” So what does that do?

From poking around the code and looking at places where `is_bare_repository` was referenced, I learned that a bare repository was one without a `.git` directory or a working tree. In other words, it’s a pretty bare repository! I assume this is the kind of thing you’d want if you weren’t using Git to version control code as much as you were looking to view code.

Side note: While doing some of these explorations, I also learned that a majority of the test cases in Git (or maybe all of them) are actually written as shell scripts. This makes sense, but I think it is interesting.

OK! The next parameter mentioned above is the `logallrefupdates` parameter. I’ll admit that I had a ton of trouble figuring out what this parameter is responsible for by poking around the code. So I cheated and looked at [the docs](https://www.kernel.org/pub/software/scm/git/docs/git-config.html) and was a little underwhelmed. It basically dictates at which granularity you want to log updates in the reflog, a local log that records changes to the HEAD commit on a branch. I’m sure I’ll be more interested in this once I learn more about the reflog (pronounced ref-log not re-flog, heh) in future explorations.

OK. So, I’m actually already familiar with what the next parameter does. `ignorecase` determines whether or not Git will ignore changes to the casing in a filename. For example, when it is set to true, Git will not treat a rename from “test.txt” to “Test.txt” as a change to the working directory.

The last parameter is the `precomposeunicode` parameter. This parameter is almost exclusively used in [this file](https://github.com/git/git/blob/e629a7d28a405e48fae6b064a781a10e885159fc/compat/precompose_utf8.c). The comment at the top of the file is quite useful.

    /*
     * Converts filenames from decomposed unicode into precomposed unicode.
     * Used on MacOS X.
     */

What’s the difference between these two kinds of Unicode? I found that [this section of a Wikipedia article](https://en.wikipedia.org/wiki/Precomposed_character#Comparing_precomposed_and_decomposed_characters) was useful in helping me decipher the distinction. Basically, precomposed characters are characters that contain an accent or addition that are stored in a single byte value. Decomposed character are characters that contain an accent or addition and are stored across two bytes.

Well! That was interesting! I learned quite a bit, especially about Git’s default behavior in edge cases (changes to filename casing or changes to file permissions). All in all, very fulfilling!

Let’s see what catches my eye next…

