---
layout: post
title: Figuring out how `curl` stores configurations
date: '2018-04-18T11:25:32-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173066235655/figuring-out-how-curl-stores-configurations
---
In [my last blog post](https://blog.safia.rocks/2018-04-16-curling-up-with-the-curl-code-base/), I started diving into the code base for the `curl` command line tool.

Sidebar: I don’t know if I’ve been consistent about spelling “command line” correctly throughout my blog posts. It turns out the proper way to spell it is as two separate words. I believe I’ve done it incorrectly and spelled it as one word in a couple of blog posts. Anyways, just a fun fact.

At the end of the last blog post, I drafted up a list of questions that I wanted to answer in my analysis of the core code of the command line tool.

1. What calls to the `libcurl` are made in the `operate` function?
2. What preprocessing, if any, is done to the arguments passed to the operate function?

So I headed over to the `src/tool_operate.c` ([link](https://github.com/curl/curl/blob/36f0f47887563b2e016554dc0b8747cef39f746f/src/tool_operate.c)) and started diving into the code.

Another sidebar: When I reference a filename, I’m usually linking directly to the source file on GitHub. I just realized that my blog theme doesn’t make this obvious when I style the text using a monospaced font. From now on, I’ll reference the files with the “(link)” parenthetical.

In the `operate` ([link](https://github.com/curl/curl/blob/36f0f47887563b2e016554dc0b8747cef39f746f/src/tool_operate.c#L1926%5D) function, the first couple of lines are responsible for, and this should come as no surprise to anyone who’s been following along with these blog posts for a while, parsing out the arguments that are passed to the `curl` command.

      /* Parse .curlrc if necessary */
      if((argc == 1) ||
         (!curl_strequal(argv[1], "-q") &&
          !curl_strequal(argv[1], "--disable"))) {
        parseconfig(NULL, config); /* ignore possible failure */
    
    ...
          else if(res == PARAM_ENGINES_REQUESTED)
            tool_list_engines(config->easy);
          else if(res == PARAM_LIBCURL_UNSUPPORTED_PROTOCOL)
            result = CURLE_UNSUPPORTED_PROTOCOL;
          else
            result = CURLE_FAILED_INIT;
        }
        else {
    #ifndef CURL_DISABLE_LIBCURL_OPTION
          if(config->libcurl) {
            /* Initialise the libcurl source output */
            result = easysrc_init();
          }
    #endif

From the last blog post, I learned that the `config` parameter referenced here is the global configuration file that is stored in `.curlrc`, as you can see from some of the code comments in the code snippet above.

Once the parameters have been parsed, the main operations of the function commence. First, the function extracts some `OperationConfig` object from the global config object.

    size_t count = 0;
    struct OperationConfig *operation = config->first;

I looked through the `curl` docs to learn a little bit more about what this `OperationConfig` object is. I found a definition of the `OperationConfig` struct ([file](https://github.com/curl/curl/blob/ba48863e52ab042a6cf754e254dfb5062a45b090/src/tool_cfgable.h)). Essentially, it contains specific attributes that are used when making the transfer request. This includes things like the user-agent to use in an HTTP request or the port to use in an FTP request. This made sense to me, but one of the things that intrigued me was the definition of the `GlobalConfig` object (referenced as `config` in the code snippet above). Below is a snippet of the parts that interested me highlighted.

    struct GlobalConfig {
      ...
      struct OperationConfig *first;
      struct OperationConfig *current;
      struct OperationConfig *last; /* Always last in the struct */
    }

So it looks like it stores three different `OperationConfig` objects under the names `first`, `current` and `last`. Why is this the case? When I saw that the `OperationConfig` object was referenced using the `config->first` statement, I figured that it might be some linked-list type structure. This suspicion was confirmed when I re-read the definition of the `OperationConfig` struct. Specifically, the last lines of the struct definition.

    struct GlobalConfig {
      struct OperationConfig *prev;
      struct OperationConfig *next; /* Always last in the struct */
    }

This makes sense now. The `OperationConfig` objects are structured in a linked-list structure. Given a `GlobalConfig` called `config`, you could find the second `OperationConfig` object in memory by calling `config->first->next` and the third by calling `config->first->next->next` and so on. Since this is a doubly linked list, you can find the second-to-last-item by calling `config->last->prev`. Cool! So now I know what this code is doing, but why does it exist? Why would you need to maintain a list of the configuration details for each operation? To be honest, I was a little bit lost on what the best approach for answering this question would be. I think exploring how the `GlobalConfig` and `OperationConfig` structs are used throughout the code base would be a waste of time and might end up leading me on tangents. I don’t wanna replay what went down with the Git code base read (yikes). I wondered if I should look through the commit logs of the code base to track down why the configuration might be structured this way. I found [this commit](https://github.com/curl/curl/commit/68920b6c113f7e3dd873d4b2d98f712c187b3765) which references that multiple operations might be executed with `curl`. An operation is something like a single HTTP request. With `curl`, you can send multiple requests out at once using a single command. The doubly-linked list structure is used to separate out the configuration options for each operation.

So this was a good way to answer the second question that I outlined above. The configuration for `curl` is operation-dependent and stored in a doubly-linked list. In the next blog post, I’ll try to answer question number one by looking at the next couple of lines of code.

            /* Perform each operation */
            while(!result && config->current) {
              result = operate_do(config, config->current);
    
              config->current = config->current->next;
    
              if(config->current && config->current->easy)
                curl_easy_reset(config->current->easy);
            }

See you next time!

