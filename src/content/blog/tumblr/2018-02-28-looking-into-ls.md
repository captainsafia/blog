---
layout: post
title: Looking into ls
date: '2018-02-28T09:37:03-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/171381157060/looking-into-ls
---
Oh hey there! It looks like I’m on this little streak where I get way into implementations for command line functions. In my last few blog posts, I dove into the code for [sudo](https://blog.safia.rocks/2018-02-23-what-happens-when-you-run-sudo/) and [cd](https://blog.safia.rocks/post/171311670379/how-does-cd-work). Today, I thought I would look into another oft-used command in my development toolkit: `ls`.

In my last blog post, I learned that `cd` was a builtin command and relied on the `chdir` Unix function to change the current working directory. As it turns out, `ls` is not a built-in command on the Bash shell. I confirmed this by doing the following.

    $ which ls
    /bin/ls

So the `ls` function is implemented as an actual binary. The source for this binary is located in the `coreutils` page within the GNU ecosystem. Some Googling and searching reveals that the source for the `ls` function is located [here](http://git.savannah.gnu.org/cgit/coreutils.git/tree/src/ls.c).

Side note: I know the “Googling and searching” bit glosses over a lot of things. For the most part, I’m very literally searching on Google for things like “ls source code” or searching through Git repositories for queries like “ls.” If you want more information about my “Google for code exploration” practices, let me know.

Since this is a C file, the tried and true place to start exploring this codebase is the read the `main` function. The `main` function is the entry point for C programs, so when we run `ls`, we start executing the code defined in the `main` function. The first couple of lines in the file are responsible for basic variable initialization.

    int i;
    struct pending *thispend;
    int n_files;
    
    initialize_main (&argc, &argv);
    set_program_name (argv[0]);
    setlocale (LC_ALL, "");
    bindtextdomain (PACKAGE, LOCALEDIR);
    textdomain (PACKAGE);
    
    initialize_exit_failure (LS_FAILURE);
    atexit (close_stdout);
    
    assert (ARRAY_CARDINALITY (color_indicator) + 1
            == ARRAY_CARDINALITY (indicator_name));
    
    exit_status = EXIT_SUCCESS;
    print_dir_name = true;
    pending_dirs = NULL;
    
    current_time.tv_sec = TYPE_MINIMUM (time_t);
    current_time.tv_nsec = -1;
    
    i = decode_switches (argc, argv);

One of the more interesting looking function calls in the code above is the `initialize_main` function call. As it turns out, it’s not (well, depends on your definition of interesting)! I tried to find the definition of `initialize_main` but was rather disappointed when I did [find it](http://git.savannah.gnu.org/cgit/coreutils.git/commit/src?id=1844eee69a9c94701606f9d274fce3dc84b15f86).

    /* Redirection and wildcarding when done by the utility itself.
       Generally a noop, but used in particular for native VMS. */
    #ifndef initialize_main
    # define initialize_main(ac, av)
    #endif

I have no idea what the heck a native VMS is (I don’t think this has anything to do with VMs as in virtual machines). I’ll have to look into this later.

The second function that caught my eye was the `decode_switches` function. I was particularly interested in this function because like the `initialize_main` function it takes the arguments of the main function (that is the arguments you pass it at the command line) as its parameters.

Instead of reading the code for the `decode_switches` function, I just read the comment above the function definition to determine what it did.

    /* Set all the option flags according to the switches specified.
       Return the index of the first non-option argument. */
    
    static int
    decode_switches (int argc, char **argv)

So it looks like that function is responsible for setting option flags, these options flags are things like the sort order and the display format that you would like the `ls` command to have.

At this point, it would be good to mention that as I read through the code for the `ls` command, I realized that a bulk of it as responsible for formatting and rendering the output of the command. The entire source file is about 5,3000 lines long, but a majority of it defines functions that handle things like “how do I print out a list of X words in Y columns?” or “how do I print this string with the correct separator?”

I’ll admit, scrolling through all this C-code can be a little tiresome. Oh, how I miss the days when all I had to do was read JavaScript source! Because C gives you so little out of the box, a lot of the code that you end up reading is not that interesting. It’s largely the kind of stuff that higher level languages implement in their standard library.

This is my way of saying I’m getting bored of reading all this C code and that I’ll end the blog post here. In summary, where you run the `ls` command on your Unix machine, you’re running the `coreutils` implementation of the `ls` command. This implementation is written in C and is responsible for parsing the arguments that you provide an appropriately rendering the results of the `ls` command in the pristine format you see in your command line.

Huzzah!

