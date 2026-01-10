---
title: "Design flashpoint: Execution modes in Aspire apps"
description: "Why Aspire has run-mode and publish-mode but no deploy-mode, and what this reveals about API design trade-offs in distributed applications."
tags: [aspire, api-design, distributed-systems]
---

In my previous blog post, I touched on the tension between Aspire's run-mode and publish-mode concepts and the notable absence of a deploy-mode. This post dives deeper into that design challenge with some background context and a healthy dose of API naming bikeshed to balance our diet.

## The Current State: Two Modes

For those unfamiliar with Aspire, it employs an "execution mode" concept that indicates the execution context of an application. Currently, the core Aspire APIs model just two modes:

- **Run mode**: Aspire orchestrates an application running locally on a developer's machine
- **Publish mode**: Aspire generates assets intended for deployment

Throughout the Aspire codebase, and in many integrations, you'll encounter logic that distinguishes between these states. Here's an example of how these APIs might be used to conditionally register different environment variables on a resource:

```csharp
public static class MyIntegrationExtensions
{
    public static IResourceBuilder<T> ConfigureEnvironmentVariables<T>(this IResourceBuilder<T> builder)
        where T : IResourceWithEnvironment
    {
        return builder.WithEnvironment((context) =>
        {
            if (context.ExecutionContext.IsRunMode)
            {
                context.EnvironmentVariables["RUNMODE_ONLY_VAR"] = "true";
                return;
            }

            context.EnvironmentVariables["PUBLISHMODE_ONLY_VAR"] = "true";
        });
    }
}
```

Another common pattern you'll see creates distinct behavior for publish mode. The [`PublishAsDockerFile` API](https://learn.microsoft.com/dotnet/api/aspire.hosting.executableresourcebuilderextensions.publishasdockerfile), for instance, provides a Dockerfile that models how an executable resource should behave during deployment:

```csharp
public static IResourceBuilder<T> PublishAsDockerFile<T>(this IResourceBuilder<T> builder,
    Action<IResourceBuilder<ContainerResource>>? configure)
        where T : ExecutableResource
{
    if (!builder.ApplicationBuilder.ExecutionContext.IsPublishMode)
    {
        return builder;
    }
    // Publish-mode only logic here
}
```

## The Challenge of Adding a Third Mode

The `IsPublishMode` and `IsRunMode` APIs used above hide an important implementation detail: these modes are modeled using the [DistributedApplicationOperation enum](https://github.com/dotnet/aspire/blob/05226437076bb5755e8a382a65bf027bc80e616c/src/Aspire.Hosting/DistributedApplicationOperation.cs). It's enum-y nature suggests that additional modes could be introduced in the future, notably a deploy mode that allows us to distinguish behavior that is specific to the active act of deploying an application, as opposed to generating the assets (Bicep template files, Docker files, Docker images, etc.) that will be used during deployment. Other useful scenarios for a distinct deploy-mode include:

- Being able to model behavior for certain deployment environments (staging versus production)
- Being able to indicate infrastructure-related resources that should only be provisioned during deployment

However, adding a new enum value introduces significant compatibility challenges. Some Aspire APIs, including the `RunAsExisting` and `PublishAsExisting` APIs for referencing existing Azure resources, are deeply coupled to the assumption of only two modes. I wrote those APIs, so I'll take the L on that.

Beyond compatibility issues, each new mode increases integration complexity exponentially. Should an integration behave differently across run mode, publish mode, *and* a hypothetical deploy mode? What happens when logic doesn't account for all modes?

Lacking a distinct third mode, deploy mode is currently modeled as a subset of publish mode and encoded in the `Deploy` property of the `PublishingOptions`. That means to write code to determine if an Aspire app is currently being deployed, you'd author something that looks like this:

```csharp
internal class MyCustomDeployResource(
    IOptions<PublishingOptions> options,
    DistributedApplicationExecutionContext executionContext)
{
    public async Task DeployAsync(DistributedApplicationModel model, CancellationToken cancellationToken)
    {
        if (executionContext.IsPublishMode && options.Value.Deploy)
        {
            // Deploy-mode specific behavior
        }
    }
}
```

Not necessarily the most beautiful bit of code written.

## The Linguistic Bikeshed

There's an alternative approach here. Instead of adding a new third-mode, we could double down on two modes but revise the existing terms that are used.

Here's where things get interesting (for me at least, lol). The terms "run" and "publish" are **verbs** describing operations, not **adjectives** describing states. As someone who likes the waste their time occasionally thinking about things that don't matter, this has always bugged me. IMO, modes should always be represented using adjectives. I've become fond of "inert" to describe the application state during publishing and deployment, when you're not actively executing the Aspire apphost but you're still interrogating the application model to make decisions. For example, during deployment I might interrogate the application model to determine the Dockerfile associated with an executable resource to support building and pushing an image associated with that Dockerfile. 

The challenge with "inert" is finding its opposite. "Active" works, but it seems like pretty much the only option that is available? By the time you get into this linguistic bikeshed, you wonder if this approach is worth it at all. Renaming APIs, especially ones that have been in the Aspire framework _for years_ (which is a long time for a young project like Aspire) is an expensive thing.

## A Broader Pattern

I can't discount enough that the concept of a "publish"/"inert" mode is a universally appealing one. In fact, I borrowed extensively from it when considering how to redesign ASP.NET Core's build-time OpenAPI document generation capabilities. There are striking parallels between an ASP.NET Core app publishing an OpenAPI document to describe its surface area and an Aspire application publishing a manifest to describe its distributed architecture or a set of deployment assets that can push this architecture to a cloud platform.

Just as you might run `aspire publish` or `dotnet run --publisher default` in an Aspire application, you could imagine running `dotnet run --publisher openapi` in an ASP.NET Core application to generate static OpenAPI documents.

Moving the mode concept deeper into the application stack (like the .NET hosting APIs layer) brings its own challenges though. The term "publish" is already overloaded in .NET, given the existing `dotnet publish` command. If we were to introduce the concept of execution modes lower in the application stack, we'd have to be _really_ careful about how we model it to support all the different application form factors that can sit on top of the hosting APIs, like console apps, REST APIs, and Aspire apps.

## Fin

While Aspire's current two-mode system (run/publish) serves most scenarios well, adding a third "deploy" mode would introduce significant API compatibility and integration complexity challenges that may not justify the benefits. The linguistic tension between operation verbs ("run," "publish") and state adjectives ("active," "inert") reveals deeper design philosophy questions about how we model application lifecycles.

The existence of these execution modes, and the current limitations in them, is a really common design flashpoint. You have an API that is just good enough to get the job done, is deeply ingrained in your framework and the integrations that sit on top of it, but shows some signs of reaching its design limits is tough. What's the trade-off of making a change earlier to avoid the current design becoming too ingrained versus waiting until there is a clear and distinct opportunity to make a breaking change?

One things for sure, I'm gonna think a little bit harder about it the next time I author a binary-style API on top of an enum. :laugh:
