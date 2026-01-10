---
title: "Reporting for duty: the story of IPipelineActivityReporter"
description: "The story of how Aspire's activity reporting API evolved from sequential progress reporting to a concurrency-aware system that powers the deployment pipeline."
---

It's a new year and it's time for a new me! And that new me actually finishes the thoughts that she has. Last year, I spent quite a bit of time writing about the Aspire deployment story and alluded to the APIs it included for sending "activites" from the Aspire AppHost to the terminal based client. Let's settle this topic once and for all and dive into these APIs and their evolution.

If you've been following my posts about [Aspire Pipelines](/2025/11/03/aspire-pipelines/) and the [CLI redesign](/2025/10/27/aspire-deploy-cli-ux/), you've seen the user-facing side of how deployment progress gets reported to the CLI. Today I want to talk about the API that makes all of that possible: `IPipelineActivityReporter`. This interface has gone through several iterations as we figured out how to model deployment activities, and its evolution mirrors the broader story of how deployment support in Aspire matured from basic callbacks to a full pipeline concept.

## The Beginning: IPublishingActivityProgressReporter

 Let's rewind to June 2025 (I can't believe I have to include the year now), during the Aspire 9.4 development cycle. We had just introduced the `aspire deploy` command and the `DeployingCallbackAnnotation` pattern I wrote about in my [pipelines post](/2025/11/03/aspire-pipelines/). We needed a way for the AppHost to communicate deployment progress back to the CLI. The initial interface was called `IPublishingActivityProgressReporter` (yeah, that's a mouthful).

The core concept was straightforward: the AppHost needed to tell the CLI "hey, I've started working on something" and then periodically update it with progress. The first version of this interface provided APIs for creating steps, updating their status, and signaling completion. It was functional but the name was...verbose. Within a week, we realized the error of our ways and renamed it to `IPublishingActivityReporter`. So at this point in time, the API shape that we were working with looked like this:

```csharp
public interface IPublishingActivityProgressReporter
{
    Task<PublishingStep> CreateStepAsync(string title, CancellationToken cancellationToken);
    Task<PublishingTask> CreateTaskAsync(PublishingStep step, string statusText, CancellationToken cancellationToken);
    Task CompleteStepAsync(PublishingStep step, string completionText, CancellationToken cancellationToken);
    Task UpdateTaskAsync(PublishingTask task, string statusText, CancellationToken cancellationToken);
    Task CompleteTaskAsync(PublishingTask task, TaskCompletionState completionState, string? completionMessage = null, CancellationToken cancellationToken = default);
    Task CompletePublishAsync(bool success, CancellationToken cancellationToken);
}
```

As you can see, this initial design introduced a hierarchy: steps were the top-level units of work, and each step could contain multiple **tasks**. This maps pretty naturally to how deployments actually work. When you're deploying to Azure, you might have a "provision infrastructure" step that contains tasks for provisioning each individual resource (CosmosDB, Storage, Container Registry, etc.). The step is the conceptual grouping, the tasks are the actual work items. One important thing to note here is that this hierarchy existed _before_ the implementation of the Aspire Pipelines mentioned earlier. However, the possibility of these reporting steps eventually become _real_ units of work did cross my mind and by the time I'm done writing you'll see how the two converged.

## The Sequential Problem

Let's talk about the sequential problem, again.

The original implementation had a critical limitation that became obvious pretty quickly: everything was sequential. When you created steps, they executed one after another. When you created tasks within a step, same deal. This made sense for the initial Azure deployment implementation because that's how we had structured the code—provision all infrastructure, then build all images, then deploy all compute resources.

But as we started working on the pipeline feature for Aspire 13, this sequential assumption became a problem. Pipelines are fundamentally about modeling dependencies and exploiting concurrency. If building the API service image doesn't depend on building the frontend image, why wait? If provisioning CosmosDB doesn't depend on provisioning Storage, why not do them in parallel?

The sequential UI also had practical problems. In the CLI, we rendered steps using Spectre's task progress components, which looked nice but didn't work well in non-interactive environments like CI/CD runners. The output would get mangled or lost entirely. We needed something that worked equally well whether you were deploying from your laptop or from a GitHub Actions runner.

If all this sounds familiar, that's because it's essentially the motivation behind the redesign CLI UI. What we are going to talk about next is the code change that enabled this.

## The October Revamp

In October 2025, I tackled both problems with [a significant revamp of the activity reporter](https://github.com/dotnet/aspire/pull/11780). The changes touched three areas:

**1. API changes to support concurrency**

The interface stayed mostly the same, but the implementation fundamentally changed. Instead of assuming steps execute sequentially, the reporter now sends all updates over a `Channel<PublishingActivity>` that the CLI consumes asynchronously. This means multiple steps can be "in progress" at the same time, sending interleaved updates.

```csharp
internal Channel<PublishingActivity> ActivityItemUpdated { get; } =
    Channel.CreateUnbounded<PublishingActivity>();
```

The reporter tracks all active steps in a `ConcurrentDictionary` and allows tasks to be created and updated within any step that's still in progress. When a step completes, no more tasks can be added to it (we throw an exception if you try). This enforces a clean lifecycle while still allowing maximal parallelism across different steps.

**2. CLI rendering for concurrent steps**

I've talked about this before in [my blog post](/2025/10/27/aspire-deploy-cli-ux/) about redesigning the CLI UI. This is how it looked in practice. We replaced the standard Spectre task progress components with a custom rendering approach that treated the activities from the AppHost as a continuous stream of events. Each step and task gets rendered with consistent formatting:

- Arrow emoji (→) when a step starts
- Checkmark (✓) when it completes successfully
- Warning/error indicators for other completion states
- Nested task updates displayed as indented lines under their parent step

This works great in both interactive and non-interactive contexts. In a terminal, you see the real-time updates. In CI logs, you get a clean sequential record of what happened.

**3. Logging and Markdown support**

We added a `Log` method to steps that allows arbitrary log messages to be emitted within a step's context. These logs can optionally use Markdown formatting, which the CLI renders appropriately (with fallbacks for non-interactive environments). This turned out to be incredibly useful for surfacing diagnostic information during deployments without cluttering the task hierarchy. And Markdown was a nice touch for helping draw user attention to key portions of the log with the support of text formatting like bolding and hyperlinking.

Fun fact: the Markdown rendering is implemented via custom Spectre component that was largely AI-authored with some human testing and iteration.

```csharp
void Log(LogLevel logLevel, string message, bool enableMarkdown);
```

## Integration with Pipelines

The activity reporter revamp happened right as we were building out the pipeline feature because the two features were deeply intertwined. The pipeline needed a way to report the status of steps executing in parallel, and the activity reporter needed to support that use case.

One interesting design point: the pipeline itself doesn't directly create steps in the activity reporter and the user doesn't need to either when creating steps in the pipeline. Instead, each `PipelineStep` can optionally create its own reporting step when it executes. This keeps the concerns separated. The pipeline is responsible for dependency resolution and execution order, the activity reporter is responsible for communicating what's happening to the client.

When a pipeline step executes, it gets access to a `PipelineStepContext` that includes a specific reporting step:

```csharp
var builder = DistributedApplication.CreateBuilder();

builder.Pipeline.AddStep("migrate-db", (context) =>
{
    var reportingStep = context.ReportingStep;
    reportingStep.Log(LogLevel.Information, "Migrating database");
    // Execute migration here
    reportingStep.Log(LogLevel.Information, "Database migration completed");
});

builder.Build().Run();
```

## Fin

The journey from `IPublishingActivityProgressReporter` to `IPipelineActivityReporter` reflects the broader evolution of deployment support in Aspire. What started as a simple need, to report progress to a CLI, became a concurrency-aware activity reporting system that integrates with pipelines and works in both interactive and non-interactive scenarios.

The core API itself ended up being deceptively small (just `CreateTaskAsync` and `CompleteAsync` and `Log`), but the implementation handles significant complexity: concurrent step execution with channel-based CLI communication, a step/task hierarchy with full lifecycle management, logging with Markdown support, and integration with `InteractionService` for mid-deployment user prompts. It's a good example of how a simple abstraction can hide sophisticated machinery while remaining straightforward to use.

If you're building custom deployment logic in Aspire and want to provide progress reporting, `IPipelineActivityReporter` is your friend. And now, you know a bit more about how it came to be.
