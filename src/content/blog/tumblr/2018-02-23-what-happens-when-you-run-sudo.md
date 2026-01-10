---
layout: post
title: What happens when you run sudo?
date: '2018-02-23T09:19:30-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/171200937595/what-happens-when-you-run-sudo
---
So, what the heck happens when you `sudo`?

If you’ve been working with computers, and specifically Unix-like systems, you’ve probably used the `sudo` command. It stands for **s** uper **u** ser **d** o. It runs whatever command you want to run as an administrator. It’s often used to give you the privilege to edit system files (like `/etc/hosts`) or to add directories to system directories and so on.

But how does it work?

If you’ve been around this blog long enough, you know what’s coming next. And you’re either terrified or excited.

It’s time to read some code!

Any command you run on a command line is likely implemented as C program. So, to figure out how `sudo` works under the hood, we just have to read some C code.

_shudders uncontrollably_

The home page for the `sudo` command can be found [here](https://www.sudo.ws). It appears that the latest stable release of `sudo`, as of writing this, is 1.8.22 which was released on January 16th, 2018. That’s surprisingly recent. In any case, I found the most recent version of the `sudo` command [on GitHub](https://github.com/millert/sudo/tree/fc82a16655e566277678d2530e85f6bdf2d63b83). Time to dive in!

This is my first time reading the C code for a Unix command, so I have no idea where to start. Ideally, I’d like to find the entry point for the application. I assume that this is going to be the `main` function in some file called `sudo.c`. I found such an entry point [in this file](https://github.com/millert/sudo/blob/fc82a16655e566277678d2530e85f6bdf2d63b83/src/sudo.c#L131). The first couple of lines of the function seem to be related to variable setup and initialization mostly.

    int nargc, ok, status = 0;
    char **nargv,** env_add;
    char **user_info,** command_info, **argv_out,** user_env_out;
    struct sudo_settings *settings;
    struct plugin_container *plugin, *next;
    sigset_t mask;
    debug_decl_vars(main, SUDO_DEBUG_MAIN)
    
    /* Make sure fds 0-2 are open and do OS-specific initialization. */
    fix_fds();
    os_init(argc, argv, envp);
    
    setlocale(LC_ALL, "");
    bindtextdomain(PACKAGE_NAME, LOCALEDIR);
    textdomain(PACKAGE_NAME);
    
    (void) tzset();

I could spend a lot of time looking into what each of these functions is, but life is short, and I don’t wanna go down that rabbit hole today. I skimmed through a couple more lines until I ran into a function that piqued my interest.

    /* Make sure we are setuid root. */
      sudo_check_suid(argc > 0 ? argv[0] : "sudo");

Intriguing! What does `setuid` mean? It’s a way to set the user ID (or the group ID but let’s not get into that here) of the command that is going to be run. Maybe you want to run a command under your standard user (captainsafia), or maybe you wanna do it under a sudo. You would use `setuid` to accomplish this. So the `sudo_check_suid` function invokes the `geteuid` function which [gets the user ID of the current running process](https://linux.die.net/man/2/geteuid). It checks to see if that is equal to the `ROOT_UID` (the user id of the root user) if not, it checks to see if the `sudo` binary is stored in the user’s `PATH` variable, which similarly, elevates the user to sudo.

If it does find the `sudo` binary in the user’s path, it sets a `qualified` variable to `true` and checks to see if the `sudo` command is running properly by calling [`stat`](http://man7.org/linux/man-pages/man2/stat.2.html) and examining the properties of the stat struct. Here’s the `sudo_check_suid` function in its entirety.

    static void
    sudo_check_suid(const char *sudo)
    {
        char pathbuf[PATH_MAX];
        struct stat sb;
        bool qualified;
        debug_decl(sudo_check_suid, SUDO_DEBUG_PCOMM)
    
        if (geteuid() != ROOT_UID) {
        /* Search for sudo binary in PATH if not fully qualified. */
        qualified = strchr(sudo, '/') != NULL;
        if (!qualified) {
            char *path = getenv_unhooked("PATH");
            if (path != NULL) {
            const char *cp, *ep;
            const char *pathend = path + strlen(path);
    
            for (cp = sudo_strsplit(path, pathend, ":", &ep); cp != NULL;
                cp = sudo_strsplit(NULL, pathend, ":", &ep)) {
    
                int len = snprintf(pathbuf, sizeof(pathbuf), "%.*s/%s",
                (int)(ep - cp), cp, sudo);
                if (len <= 0 || (size_t)len >= sizeof(pathbuf))
                continue;
                if (access(pathbuf, X_OK) == 0) {
                sudo = pathbuf;
                qualified = true;
                break;
                }
            }
            }
        }
    
        if (qualified && stat(sudo, &sb) == 0) {
            /* Try to determine why sudo was not running as root. */
            if (sb.st_uid != ROOT_UID || !ISSET(sb.st_mode, S_ISUID)) {
            sudo_fatalx(
                U_("%s must be owned by uid %d and have the setuid bit set"),
                sudo, ROOT_UID);
            } else {
            sudo_fatalx(U_("effective uid is not %d, is %s on a file system "
                "with the 'nosuid' option set or an NFS file system without"
                " root privileges?"), ROOT_UID, sudo);
            }
        } else {
            sudo_fatalx(
            U_("effective uid is not %d, is sudo installed setuid root?"),
            ROOT_UID);
        }
        }
        debug_return;
    }

Yes! It’s a lot of code. But don’t be frightened. C code is often excessively verbose because you have to do a lot of things like string concatenation and splitting and error checking manually (errr, more manually than you would in other languages). Higher level languages take care of a lot of this stuff for you. Thank you, Python and JavaScript (and others)!

At this point, I’m scrolling through the rest of the code for the `main` function in `sudo.c` and, boy, is there a lot going on! Most of it is setting configurations and warning the user if things aren’t set up correctly.

There was one line of code that caught my eye.

    if (!sudo_load_plugins(&policy_plugin, &io_plugins))
        sudo_fatalx(U_("fatal error, unable to load plugins"));

`sudo_load_plugins`? What plugins are we loading? What’s going on here? It’s time to investigate!

It turns out that `sudo_load_plugins` is defined in [another file](https://github.com/millert/sudo/blob/fc82a16655e566277678d2530e85f6bdf2d63b83/src/load_plugins.c). This function was really long, so I decided just to read the function definition to see if it could provide some information about what the function might do. Usually, in C, you pass pointers to objects into a function. The function then modifies the objects pointed to by those pointers and returns some status code. So by looking at the function definition, I can get a pretty good sense of what the function is doing. In this case, the function definition for `sudo_load_plugins` looks like this.

    static bool
    sudo_load_plugin(struct plugin_container *policy_plugin,
        struct plugin_container_list *io_plugins, struct plugin_info *info)

So the three structs that are modified in this function are the `plugin_container`, `plugin_container_list`, and `plugin_info`. I did some more digging around the code. I won’t narrate all that I did here because it would take a while but I’ll just summarize it here.

The `sudo_load_plugins` function is responsible for loading policy plugins. The policy plugins are used to define what the privileges the `sudo` command has for a particular user. If you were administering a Unix system, you could configure sudo never to be able to execute a certain command under `sudo` for any user or to add logging for sessions. That’s useful!

OK! Back to looking at the `main` function. The next interesting bit of code is [a giant switch statement](https://github.com/millert/sudo/blob/fc82a16655e566277678d2530e85f6bdf2d63b83/src/sudo.c#L216). It checks the value of the bitwise and the `sudo_mode` and `MODE_MASK` variables against a set of constants.

    switch (sudo_mode & MODE_MASK) {

I won’t go into the details of the code line by line, but here’s the overall gist. As it turns out, the `sudo` command can be run in a variety of different modes. You can run it in one mode that allows you to preserve the `SHELL` variables used by the command (`MODE_SHELL`).

The last portion of the `main` function has an extra helpful comment to explain what is going on.

    /*
    * If the command was terminated by a signal, sudo needs to terminated
    * the same way. Otherwise, the shell may ignore a keyboard-generated
    * signal. However, we want to avoid having sudo dump core itself.
    */
    if (WIFSIGNALED(status)) {
        struct sigaction sa;

So basically, if the command that we are running is sudo exits unexpectedly than so should sudo.

Phew! A lot was going on in that function. And to be honest, even more in the `sudo` command in general. I learned that there is a lot more to `sudo` than just `sudo !!`. I’m not a Unix system administrator or anything, so I wasn’t aware of all the ways that `sudo` can be used to monitor and restrict access to privileged commands across Unix systems. The more you know!

Thank you to [Todd Miller](https://github.com/millert), the maintainer of sudo, for maintaining such a valuable tool!

