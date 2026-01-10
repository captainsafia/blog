---
layout: post
title: Rolling in render trees
tags: [blazor]
date: 2020-10-26 00:00:00 -0500
---

This is the second blog post in a mini-series on the internals of rendering and components in Blazor. By internals, I mean that we’ll be doing one of my favorite things: reading code and figuring out what it does. As a preface, this blog post assumes that you’re familiar with [Blazor](https://blazor.net).

If you haven't read the first blog post already, I'd recommend [taking a look at it](./combing-through-component-base) before reading the rest of this post. We'll be picking up right where we left off. In the last blog post, we discussed the `ComponentBase` class in Blazor. Each component has a `StateHasChanged` method that is invoked when the component needs to be rendered. We'll use this method as a transition from our exploration of `ComponentBase` to our dive into render trees.

```csharp
protected void StateHasChanged()
{
    if (_hasPendingQueuedRender)
    {
        return;
    }

    if (_hasNeverRendered || ShouldRender())
    {
        _hasPendingQueuedRender = true;

        try
        {
            _renderHandle.Render(_renderFragment);
        }
        catch
        {
            _hasPendingQueuedRender = false;
            throw;
        }
    }
}
```

The relevant parts of this method are the invocation of `_renderHandle.Render(_renderFragment)` in the try-catch block. We'll start our exploration by looking at render handles.

A render handle is a construct that allows a component to interact with its handler, so it _definitely_ is a great transition from talking about components to talking about rendering. At it's core, the `RenderHandle` maintains a reference to two key properties: the renderer and an integer representing the ID of the component the render handle is associated with. The `Render` method invoked above calls into the `AddToRenderQueue` method on the `Renderer` to facilitate rendering.

The `RenderHandle` class is onl 60-odd lines of code (and fifteen or so if you ignore whitespace nad newlines.) You can check out the code for it [here](https://github.com/dotnet/aspnetcore/blob/0d31fa0f54474289fa6e3910f7f40d2bf8f9b5d4/src/Components/Components/src/RenderHandle.cs). Logically, the `RenderHandle` access as a gated bridge between the user-facing world of components and the internals of rendering. It's a small wrapper around the rendering APIs that are relevant to components without exposing all the rendering internals that we will discuss shortly. For example, because the `RenderHandle` "bridge" exists, a component doesn't need to know its component ID in order to render itself. It can make a call out to `AddToRenderQueue` via `StateHasChanged` without having to worry about any of the internals.

## Biting into the Renderer

Unlike the `RenderHandle`, the `Renderer` implementation has a fair amount of logic. After all, that's where all the fun behind the gated bridge happens! We'll break into the `Renderer` by taking a look at the [`AddToRenderQueue`](https://github.com/dotnet/aspnetcore/blob/0d31fa0f54474289fa6e3910f7f40d2bf8f9b5d4/src/Components/Components/src/RenderTree/Renderer.cs#L377-L396) method that's invoked above.

```csharp
internal void AddToRenderQueue(int componentId, RenderFragment renderFragment)
{
    Dispatcher.AssertAccess();

    var componentState = GetOptionalComponentState(componentId);
    if (componentState == null)
    {
        return;
    }

    _batchBuilder.ComponentRenderQueue.Enqueue(new RenderQueueEntry(componentState, renderFragment));

    if (!_isBatchInProgress)
    {
        ProcessPendingRender();
    }
}
```

Let's break down what is going on here line-by-line.

**Dispatcher.AssertAccess()**

The [`Dispatcher`](https://github.com/dotnet/aspnetcore/blob/0a79d34f62a2e153d7104a88b487b75ef8860bb7/src/Components/Components/src/Dispatcher.cs) is responsible for facilitating event handling and asynchronous invocations within the renderer. Similar to what we discussed earlier about the `RenderHandle` being the gated bridge between the world of components and the world of rendering, the `Dispatcher` is the gated bridge between the world of rendering and the world of 

The default dispatcher associated with each renderer is a [`RendererSynchronizationContextDispatcher`](https://github.com/dotnet/aspnetcore/blob/062237e054487e2e53c186660e459eda69b75e59/src/Components/Components/src/Rendering/RendererSynchronizationContextDispatcher.cs), which implements a [SynchronizationContext](https://docs.microsoft.com/en-us/dotnet/api/system.threading.synchronizationcontext). SynchronizationContext allow a developer to dictate how asynchronous operations that are dispatched to to the synchronization context should be handled. For example, the [RendererSynchronizationContext](https://github.com/dotnet/aspnetcore/blob/062237e054487e2e53c186660e459eda69b75e59/src/Components/Components/src/Rendering/RendererSynchronizationContext.cs) will attempt to [execute async tasks synchronously](https://github.com/dotnet/aspnetcore/blob/062237e054487e2e53c186660e459eda69b75e59/src/Components/Components/src/Rendering/RendererSynchronizationContext.cs#L69-L85) if there are [no other operations being processed](https://github.com/dotnet/aspnetcore/blob/062237e054487e2e53c186660e459eda69b75e59/src/Components/Components/src/Rendering/RendererSynchronizationContext.cs#L180-L198).

**var componentState = GetOptionalComponentState(componentId)**

A [`ComponentState`](https://github.com/dotnet/aspnetcore/blob/062237e054487e2e53c186660e459eda69b75e59/src/Components/Components/src/Rendering/ComponentState.cs) object is used to the track the current rendering state of the component. It's responsible for a few things including:

- Subscribing to changes in [cascading parameters](https://docs.microsoft.com/en-us/aspnet/core/blazor/components/cascading-values-and-parameters) and notifying the component to update its parameters if they've been changed. If you've ever wandered how the value for a cascading parameter is propagated to all child components, the `ComponentState` object is responsible for it.
- Notifying the component when [rendering has been completed](https://github.com/dotnet/aspnetcore/blob/6a82a84b10a8073f262ea53d7f8e01fa6cbfca08/src/Components/Components/src/Rendering/ComponentState.cs#L120-L136) to trigger any `OnAfterRender` lifecycle methods
- Maintaining a reference to the parent component's `ComponentState` which is useful for tracking cascading parameters

You'll notice in the logic above that we don't invoke any rendering if we don't have a `ComponentState` object registered for the current component. The `Renderer` maintains a dictionary of { componentId: ComponentState } and exposes two variants for accessing a `ComponentState` by ID.

- `GetOptionalComponentState` returns the `ComponentState` for a given component ID or returns null. This is typically used in scenarios where we want to respond to a component that has already been disposed. Components that have been disposed can't re-render.
- `GetRequiredComponentState` returns the `ComponentState` for a given component ID and throws an exception if none is found. This more aggressive approach is used in code paths where we want to guarantee that a `ComponentState` exists before using it, such as before disposing of component state.

In the case above, we avoid queueing a new render operation if the component has already been disposed.

**_batchBuilder**

The `_batchBuilder` property is an instance of a [`RenderBatchBuilder`](https://github.com/dotnet/aspnetcore/blob/062237e054487e2e53c186660e459eda69b75e59/src/Components/Components/src/Rendering/RenderBatchBuilder.cs) associated with the current renderer.

Render batches capture the changeset in a current render operation that will be applied to the DOM. This includes things like:

- The set of components that were modified or rendered in a batch sequence
- The edits that were made in each component
- The set of components that were disposed during a render

The `_batchBuilder` is responsible for maintaining the queue of components to be rendered and the set of modifications to be made. In the renderer, it's used to:

- Compute a batch object for the current render option
- Clear the state after a render batch has been processed
- Access the queue of components to be rendered

**.ComponentRenderQueue**

The `ComponentRenderQueue` property maintains the set of the rendering events that still need to be completed by the renderer.

**.Enqueue(new RenderQueueEntry(componentState, renderFragment))**

Before performing a render, we first add it to the render queue. If no renders are currently in progress, we process it immediately. If there is a render in progress, we don't do anything since the enqueued render batch will be processed in that render step.

**ProcessPendingRender()**

The `ProcessPendingRender` method is invoked if we can process remaining renders off the render queue. If the renderer hasn't been disposed, [the method](https://github.com/dotnet/aspnetcore/blob/0d31fa0f54474289fa6e3910f7f40d2bf8f9b5d4/src/Components/Components/src/RenderTree/Renderer.cs#L429-L437) will invoke `ProcessRenderQueue`.

## Conclusion 

We'll dive into the internals of the `ProcessRenderQueue` method in the next blog post. For now, here's a quick summary of what we covered:

- Concepts like the `Dispatcher` and `RenderHandle` provide abstractions for connecting the worlds of components, rendering, and event handling together.
- The Renderer leverages a stateful `ComponentState` object to manage state that exists outside of a single render, like trigger after render lifecycle methods or processing cascading parameters.
- Rendering work is packaged intro discrete render batches that are managed in a queue and applied to the DOM as batches are dequeued.