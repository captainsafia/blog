---
layout: post
title: Getting into git init
date: '2018-03-02T08:03:00-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/171448973555/getting-into-git-init
---
So, ever the easily-distracted squirrel that I am, I’ve gotten curious about yet another thing.

Git.

I’ve been using Git for about five years now, so I know my way around the tool a little bit. But I’ve never actually dived into the code for Git to figure out how it was implemented.

If you write software for a living (or perhaps for fun), you’ve likely been using Git for a long time too. There is a lot to unpack with Git, but as all things do, I’m going to start at the beginning, the very beginning.

    $ git init

What exactly happens when you run `Git init`? I started as I usually do, by reading some docs. In the same way that it helps to write the docs before you write the code, it also helps to read the docs before you read the code. So what does [the documentation page for `Git init`](https://Git-scm.com/docs/Git-init) say?

> git-init - Create an empty Git repository or reinitialize an existing one

OK! That’s pretty transparent. There are, of course, a couple of flags and options that you can pass to the `git init` command to customize its functionality, but I’m gonna ignore that. I’m itching to dive into some code right about now, so let’s do it.

I’ve never looked at the codebase for Git before. I don’t know the folder structure. I don’t know anything. Well, that’s not exactly true, but all good writing has hyperbole! But I’m ready to dive in! Thankfully, there is a mirror of the `Git` source on GitHub. You can find that [here](https://Github.com/Git/Git).

The first thing I did was scroll through some of the directories and files at the top level of the source repository. I was surprised to discover that a lot of the C header and source files associated with top-level Git commands like `git diff` and `git fetch` were actually stored at the top-level directory. I expected them to be organized into subdirectories. Ah well, life’s full of surprises.

I looked through these top-level files to see if there was a source file that might be associated with the `Git init` command but there wasn’t. Gasp! The next thing I did was search through the source directory for source files that contained `init` in the name. I came across [this](https://Github.com/Git/Git/blob/7e31236f652ad9db221511eaf157ce0ef55585d6/builtin/init-db.c) promising return. I read through some of the comments in the code and confirmed that this was indeed the source file that was responsible for the functionality of `git init`.

Usually, I would look for the definition of the `main` function in this file to figure out what was going on. I quickly discovered that the file I found was a library file that stored the functions associated with initializing a Git repository but not the actual entry point code. Regardless, after scrolling through some of the functions and guessing what they might be responsible for based on their names and the parameters they took in, I realized that the function responsible for a lot of the heavy lifting was the [`init_db`](https://Github.com/Git/Git/blob/7e31236f652ad9db221511eaf157ce0ef55585d6/builtin/init-db.c#L337) function.

    int init_db(const char *git_dir, const char *real_git_dir,
            const char *template_dir, unsigned int flags)

So, I’m gonna try and focus most of my code reading on seeing how the parameters are utilized throughout the function. I’ll start by figuring out what the `git_dir` parameter might be used for. After reading some of the code, I figured that the `git_dir` command corresponded (obviously, in hindsight) to the path of the `.git` subdirectory that exists in source directories of projects that are version controlled with Git. Throughout the code in this function, `git_dir` is used to determine whether or not a `.git` directory already exists. I also noticed that the `git_dir` parameter has a close relationship with the `real_git_dir` parameter. Take a look at the snippet of code below.

    if (real_git_dir) {
        struct stat st;
    
        if (!exist_ok && !stat(git_dir, &st))
            die(_("%s already exists"), git_dir);
    
        if (!exist_ok && !stat(real_git_dir, &st))
            die(_("%s already exists"), real_git_dir);
    
        set_git_dir(real_path(real_git_dir));
        git_dir = get_git_dir();
        separate_git_dir(git_dir, original_git_dir);
    }
    else {
        set_git_dir(real_path(git_dir));
        git_dir = get_git_dir();
    }

What’s the difference between `git_dir` and `real_git_dir`? Why is this code so gatekeep-y? I tried to Google the two parameter names to see if someone had made a similar inquiry before, but it turns out that there is nothing on the indexed Internet that is of use to me on this front.

**cue Sound of Silence playing in the background as I stare absentmindedly at my computer screen**

So I’m gonna have to do a little bit more code reading in order to figure out what the distinction actually is. After reading the code, I eventually figured out what `real_git_dir` was responsible for. The line of code below helped.

    OPT_STRING(0, "separate-git-dir", &real_git_dir, N_("gitdir"),
               N_("separate git dir from working tree")),

It turns out that the value of `real_git_dir` is the value set to the argument `separate-git-dir`. This argument is used to do the following per the documentation.

> —separate-git-dir=<git dir></git>
> 
> Instead of initializing the repository as a directory to either `$GIT_DIR` or `./.git/`, create a text file there containing the path to the actual repository. This file acts as filesystem-agnostic Git symbolic link to the repository.
> 
> If this is reinitialization, the repository will be moved to the specified path.

Interesting! Now I see the interaction between the two. The `git_dir` parameter is the path of the `.git` directory while the `real_git_dir` parameter is the path of a text file that is used to create a cross-platform symlink-like thing to the `.git` directory. Glad I figured that out! Now I can sleep easy at night.

So the code in the snippet above is responsible for figuring out the location of the `.git` directory whether it is stored in a symlink-like thing or an actual directory.

OK! The next couple of lines of code are pretty easy to understand based on the function calls.

    startup_info->have_repository = 1;
    
    safe_create_dir(git_dir, 0);
    
    init_is_bare_repository = is_bare_repository();
    
    /* Check to see if the repository version is right.
    * Note that a newly created repository does not have
    * config file, so this will not fail. What we are catching
    * is an attempt to reinitialize new repository with an old tool.
    */
    check_repository_format();
    
    reinit = create_default_files(template_dir, original_git_dir);
    
    create_object_directory();

Essentially, the snippet of code above creates the `.git` directory if it is not already created and checks to see if this is a bare repository. I assume the `create_default_files` function is basically responsible for creating things like the directories and files inside the `.git` directory.

The next segment of code does some stuff depending on the value returned from the `get_shared_repository()` function. What is a shared repository exactly?

    if (get_shared_repository()) {
        char buf[10];
        /* We do not spell "group" and such, so that
             * the configuration can be read by older version
             * of Git. Note, we use octal numbers for new share modes,
             * and compatibility values for PERM_GROUP and
             * PERM_EVERYBODY.
             */
        if (get_shared_repository() < 0)
            /* force to the mode value */
            xsnprintf(buf, sizeof(buf), "0%o", -get_shared_repository());
        else if (get_shared_repository() == PERM_GROUP)
            xsnprintf(buf, sizeof(buf), "%d", OLD_PERM_GROUP);
        else if (get_shared_repository() == PERM_EVERYBODY)
            xsnprintf(buf, sizeof(buf), "%d", OLD_PERM_EVERYBODY);
        else
            die("BUG: invalid value for shared_repository");
        git_config_set("core.sharedrepository", buf);
        git_config_set("receive.denyNonFastforwards", "true");
    }

The first thing I figured I would do is to look through the documentation of the Git to see if there is any reference to this. I eventually came across [this StackOverflow post](https://stackoverflow.com/questions/7268560/change-Git-repository-to-shared) which explained that shared repositories are repositories that are shared amongst users in a group on a system. So basically, what the code above is doing is checking to see if the user requested that the Git repository initiated be shared amongst users on a machine and setting up the proper Git configuration.

Side note: Remember when I was reading through the Node codebase, and I said you should always read the documentation before reading the code. Or when I said that five paragraphs ago? I really oughta take my own advice…

Finally, the program prints out some useful information about whether a Git repository was initialized and where it was initialized.

    if (!(flags & INIT_DB_QUIET)) {
        int len = strlen(git_dir);
    
        if (reinit)
            printf(get_shared_repository()
                   ? _("Reinitialized existing shared Git repository in %s%s\n")
                   : _("Reinitialized existing Git repository in %s%s\n"),
                   git_dir, len && git_dir[len-1] != '/' ? "/" : "");
        else
            printf(get_shared_repository()
                   ? _("Initialized empty shared Git repository in %s%s\n")
                   : _("Initialized empty Git repository in %s%s\n"),
                   git_dir, len && git_dir[len-1] != '/' ? "/" : "");
    }
    
    free(original_git_dir);
    return 0;

That last line caught my eye. `free(original_git_dir)`. What’s that all about? I already know that `free` is the C function that is responsible for deallocating memory. It turned out not to be all that interesting. This line is just freeing some space that was allocated for a string that was configured earlier. I had overlooked the line where it was being allocated earlier in my code read so this free came as a surprise to me. Overlooking memory allocations is the source of many memory leaks!

Side note: Yes, you are allowed to squirm at that pun/word play.

So that’s it! Well, clearly not all of it. But I think this is a pretty interesting start. I learned a couple of things.

- Git is always spelled with a capital “G” even it if is in the middle of the sentence.
- You can create symlink-like objects to reference `.git` directories.
- You can share repositories amongst groups.

I’ve also got a couple more questions that I’d like answered, but I’ll leave those for some other posts.

Tata for now, Internet void! Until next time…

