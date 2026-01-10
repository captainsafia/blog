---
layout: post
title: Digging further into the curl code base
date: '2018-04-20T19:25:10-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173142398645/digging-further-into-the-curl-code-base
---
In [the last blog post](https://blog.safia.rocks/2018-04-18-figuring-out-how-curl-stores-configurations/) I wrote, I learned how `curl` maintains the configuration details for different operations. In this blog post, I’d like to figure out how `curl` executes these operations. Specifically, I’d like to dive into what is going on in the segments of code outlined below.

    /* Perform each operation */
    while(!result && config->current) {
        result = operate_do(config, config->current);
    
        config->current = config->current->next;
    
        if(config->current && config->current->easy)
            curl_easy_reset(config->current->easy);
    }

So what’s going on here? As mentioned previously, the configuration for each of the operations that `curl` is executing is stored in a doubly linked list.

Sidebar: For those who are not familiar with the doubly linked list data structure, it is similar to a linked list, but in addition to having a pointer to the next node in each node, you also have a pointer to the previous point. Read [this](https://www.tutorialspoint.com/data_structures_algorithms/doubly_linked_list_algorithm.htm) for more.

The while loop above iterates through each of the configurations that are currently stored in memory and executes the correlated operation. The most interesting (and ominous sounding) function here is the `operate_do` function. You can tell by its name, but the `operate_do` function sure does a whole lot. I kid you not; the entire function is around 1,700 lines. Is that even legal to do? I feel like there should be a rule against doing something like this. How do you even begin to investigate a function that long?

I’ll tell ya how. You scroll through the code really fast. I’m not kidding. When a function is this long, you can often see the patterns visually. For example, as I scrolled through the code, I realized that a fair chunk of the code contained invocations to functions like `my_setopt_str` and `my_setopt` and `my_setopt_enum`. If I had to eyeball it, I would say that about 70% of the lines of code in the function were invocations to `my_setopt*` style functions.

These functions take as input a `curl` parameter which is a reference to a `CURL` object stored in the configuration and the configuration item that should be set up. I wasn’t too interested in digging into this function. Looking at the function name and parameters gave me a rough idea of the purpose of these chunks of code: “before we actually execute an operation, make sure that its operation configurations are stored in the correct place.”

Once I figured out the `my_setopt` trend in the `operate_do` function, I tried to look through the noise and see if I could find where the actual “doing” was happening. There were a couple of interesting chunks. For example, the code below is an introduction to the logic that iterates through each of the URLs in the URL list and executes a particular set of functions over each URL.

      /*
      ** Nested loops start here.
      */
    
      /* loop through the list of given URLs */
    
      for(urlnode = config->url_list; urlnode; urlnode = urlnode->next) {

For example, it executes code associated with uploading files to a particular API endpoint.

        /* Here's the loop for uploading multiple files within the same
           single globbed string. If no upload, we enter the loop once anyway. */
        for(up = 0 ; up < infilenum; up++) {
        ...
        }

And most of the `my_setopt` functions that I observed above were located within the for-loop iterating through each of the URLs.

The last thing that I wanted to investigate was where the `result` object that is returned from the `operate_do` function is manipulated. This object is an integer status code that represents the status of the `curl` execution (whether it has run into an error or if a parameter is missing). Since it is a representation of a particularly important status code, anytime it is modified it is probably associated with an important function call. Here are all the places where the `result` object is modified in the `operate_do` function.

1. `result = CURLE_FAILED_INIT;` ([L241](https://github.com/curl/curl/blob/899630021153b2a26a43008cccc6620b6c3f9bbf/src/tool_operate.c#L214))
2. `result = curl_easy_getinfo(config->easy, CURLINFO_TLS_SSL_PTR, &tls_backend_info);`([L237-L239](https://github.com/curl/curl/blob/899630021153b2a26a43008cccc6620b6c3f9bbf/src/tool_operate.c#L237-L239))

Woah. I’ve only written up to of the references, and I’ve realized that if I do them all, I’m gonna be here all day and I’ve got a lot of errands to run. I’ll spare you the pain of having to read through all the references and summarize the trend that I am seeing. Essentially, the `result` is modified whenever an HTTP request fails or if some sort of SSL certificate is configured improperly or if there isn’t enough memory to write the output of a request and so on and so on. Reading through the places in the code where the `result` was modified gave me a lot of perspective into how much heavy lifting the `operate_do` function did, aka all of it.

I’m debating whether I want to dive more rigorously into this function or not. Part of me feels like there is more to be discovered but another part of me feels like I need to get more organized about my approach for reading through this code. After thinking about it for a little bit, I decided that I would try to do another code dive by observing what happens specifically when the following `curl` command is executed.

    $ curl https://safia.rocks

Until next time!

