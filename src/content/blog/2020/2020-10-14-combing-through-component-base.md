---
layout: post
title: Combing through ComponentBase
tags: [blazor]
---

This is the first blog post in a mini-series on the internals of rendering and components in Blazor. By internals, I mean that we'll be doing one of my favorite things: reading code and figuring out what it does. As a preface, this blog post assumes that you're familiar with [Blazor](https://blazor.net/).

Blazor, like many modern web frameworks, provides a component-model that allows users to colocate UI elements that represent shared business logic into single units, known as components. React, Vue, Angular, and Svetle all have similar concepts in their respective implementations. The framework's component model ties into other key concepts in the framework associated with event handling, rendering, and data management. So, as it turns out, taking a look at framework's component implementation is a great way to get a sense of the framework overall.

### In the beginning, there was ComponentBase

The main character in Blazor's component model is the `ComponentBase` class ([ref](https://github.com/dotnet/aspnetcore/blob/795584e177852a2cb95d4e7b0df2ae7d94fac157/src/Components/Components/src/ComponentBase.cs)). The first thing to examine is the class declaration for `ComponentBase` itself:

```csharp
public abstract class ComponentBase : IComponent, IHandleEvent, IHandleAfterRender
```

This is only one line of code but we can actually unpack quite a bit from it.

For starters, `ComponentBase` is an `abstract` (aka base) class. You cannot instantiate an instance of the `ComponentBase` class itself, but most Blazor components derive from the `ComponentBase` class itself.

Most? Not all? Correct! Not all components have to implement `ComponentBase`. In fact, the `Router` component that we looked at in last week's blog post doesn't derive from `ComponentBase`. It implements the much narrower `IComponent` interface ([ref](https://github.com/dotnet/aspnetcore/blob/795584e177852a2cb95d4e7b0df2ae7d94fac157/src/Components/Components/src/IComponent.cs)).

```csharp
public interface IComponent {
    void Attach(RenderHandle renderHandle);
    Task SetParametersAsync(ParameterView parameters);
}
```

Pretty bare bones, huh? Notably, the `IComponent` interface does not require that the component implement Blazor's component lifecycle methods or support any event handling. This makes the `IComponent` interface an ideal base for component's that don't require any kind of interactivity, like the `Router` component mentioned above or [the LayoutView component](https://github.com/dotnet/aspnetcore/blob/724c2e75a7415e67f9f5ad33fc72bf55507b8d59/src/Components/Components/src/LayoutView.cs).

One key thing to note: the `IComponent` interface is used throughout the codebase for component discovery and rendering. That means that components aren't required to derive from `ComponentBase` in order to plug in with everything else.

That being said, `ComponentBase` is where all the interesting stuff happens so let's continue our exploration of that.

### The Lifecycle Methods

Whenever I think about lifecycle methods in components (whether Blazor or React), I always think back to those "Life Cycle of a Cell" diagrams from high school. The concepts are actually fairly similar. A component has particular stages of development, from when it is first rendered on the page to when it is discarded. Components can also react to changes in their "environment", such as triggered events or parameter changes.

#### SetParametersAsync

Parameters are the first concept will cover in components. Parameters are attributes that are passed to the component and used within the component for conditional rendering or to issue network requests or any number of factors. Parameters are one of the many entities that bridge data and user interfaces together. Where in the component lifecycle do parameters come in?

The implementation for `SetParametersAsync` is pretty succinct ([ref](https://github.com/dotnet/aspnetcore/blob/b0247ccadac4b1640b53e610e2ade926308d0cec/src/Components/Components/src/ComponentBase.cs#L211-L224)). We evaluate whether or not the component has been initialized. If it hasn't, that means we're processing the initial parameters of the component and we'll need to initialize before setting those. This is where the `OnInitialized` and `OnInitializedAsync` lifecycle methods come in.

> Note: An override of the `SetParametersAsync` method is required by the `IComponent` interface. That means that even if a component doesn't handle events or have lifecycle methods, it still needs to provide a way to take parameters and set them.

#### OnInitialized/OnInitializedAsync

The `OnInitialized` overrides are provided by the component and are invoked when the component is first instantiated. Whenever we invoke a lifecycle method in a Blazor component, we invoke its synchronous variant then dispatch its asynchronous variant. If the asynchronous variant hasn't completed (whether successfully or via a cancellation), we trigger a re-render then await its completion.

```csharp
OnInitialized();
var task = OnInitializedAsync();

if (task.Status != TaskStatus.RanToCompletion && task.Status != TaskStatus.Canceled)
{
    StateHasChanged();

    try
    {
        await task;
    }
    catch
    {
        if (!task.IsCanceled)
        {
            throw;
        }
    }
}

```

#### OnParametersSet/OnParametersSetAsync

If a component has already been initialized, all we need to do is set the parameters. What does "set the parameters" mean here? Well, as it turns out, the `CallOnParametersSetAsync` method uses the same pattern utilized above. We invoked the synchronous and asynchronous variant then trigger a render.

```csharp
private Task CallOnParametersSetAsync()
{
    OnParametersSet();
    var task = OnParametersSetAsync();
    var shouldAwaitTask = task.Status != TaskStatus.RanToCompletion &&
        task.Status != TaskStatus.Canceled;

    StateHasChanged();

    return shouldAwaitTask ?
        CallStateHasChangedOnAsyncCompletion(task) :
        Task.CompletedTask;
}
```

##### OnAfterRender/OnAfterRenderAsync

Blazor's component lifecycle methods also provide an API for executing logic _after_ a component has rendered. This is where the third interface the `ComponentBase` class implements comes in: the `IHandleAfterRender` interface.

The `OnAfterRender` methods are invoked, as the name suggests, after a component has been rendered. We'll discuss where and how it's invoked in a later blog post.

### Event handling

Now that we've covered the lifecycle methods, we'll cover another dimension to components: event handling. Events occur during the lifespan of a component and typically reflect actions taken by the user, such as the click of a button or key presses on an input field. These events trigger callbacks that process the event and execute some sort of action. This "action" will typically trigger a state change on the component, perhaps by setting the validation state on a field or changing the text content of an element.

As discussed earlier, the `ComponentBase` class implements the `IHandleEvent` interface with requires a `HandleEventAsync` method implementation ([ref](https://github.com/dotnet/aspnetcore/blob/b0247ccadac4b1640b53e610e2ade926308d0cec/src/Components/Components/src/ComponentBase.cs#L301-L315)).

```csharp
Task IHandleEvent.HandleEventAsync(EventCallbackWorkItem callback, object? arg)
    var task = callback.InvokeAsync(arg);
    var shouldAwaitTask = task.Status != TaskStatus.RanToCompletion &&
        task.Status != TaskStatus.Canceled;

    // After each event, we synchronously re-render (unless !ShouldRender())
    // This just saves the developer the trouble of putting "StateHasChanged();"
    // at the end of every event callback.
    StateHasChanged();

    return shouldAwaitTask ?
        CallStateHasChangedOnAsyncCompletion(task) :
        Task.CompletedTask;
}
```

OK, admittedly, this is not particularly enlightening. As it turns out, to get the full story of the event handling lifecycle in Blazor, we have to step outside of the `ComponentBase` implementation. Let's start off by talking about how event handling is implemented in a component. Below is the code for our beloved `Counter` page in the default Blazor template. The `button` element contains an `onclick` event handler.

```csharp
@page "/counter"

<h1>Counter</h1>

<p>Current count: @currentCount</p>

<button class="btn btn-primary" @onclick="IncrementCount">Click me</button>

@code {
    private int currentCount = 0;

    private void IncrementCount()
    {
        currentCount++;
    }
}
```

When this component is compiled, the `onclick` handler is converted into an `EventCallback` object. 

```csharp
_builder.AddAttribute(7,
    "onclick",
    Microsoft.AspNetCore.Components.EventCallback.Factory.Create<Microsoft.AspNetCore.Components.Web.MouseEventArgs>(this, IncrementCount));
```

This factory class generates an `EventCallback` object ([ref](https://github.com/dotnet/aspnetcore/blob/15f341f8ee556fa0c2825cdddfe59a88b35a87e2/src/Components/Components/src/EventCallback.cs)) that ties together two concepts: the component an event handler is registered on and the event handler's callback itself. Whenever we create an `EventCallback`, we provide these two values in the form of a `receiver` of the event which implements an `IHandleEvent` interface (hint, hint: that's our component) and the callback itself.

> Note: EventCallback objects can also be created in a component when instantiated by a user.

```csharp
public EventCallback(IHandleEvent? receiver, MulticastDelegate? @delegate)
{
    Receiver = receiver;
    Delegate = @delegate;
}
```

Whenever the `EventCallback` is invoked, we call the `HandleEventAsync` implementation on the receiver, also known as the `HandleEventAsync` implementation in `ComponentBase` ([ref](https://github.com/dotnet/aspnetcore/blob/15f341f8ee556fa0c2825cdddfe59a88b35a87e2/src/Components/Components/src/EventCallback.cs#L54-L62)).

```csharp
public Task InvokeAsync(object? arg)
{
    if (Receiver == null)
    {
        return EventCallbackWorkItem.InvokeAsync<object?>(Delegate, arg);
    }

    return Receiver.HandleEventAsync(new EventCallbackWorkItem(Delegate), arg);
}
```

If you've followed this so far, you might've noticed the gap missing in the flow below. How exactly does an `EventCallback` get invoked? This touches into event dispatch, a topic that's best covered in another blog post (stay tuned!). But for now, the flow for event handling looks roughly like this:

1. An `EventCallback` object is created that associated an event handler with the component it is registered on.
2. When an event is dispatched, the `InvokeAsync` method on the associated `EventCallback` is invoked. This is the part that will be covered in more detail in a future blog post.
3. If the event is associated with a component, the `HandleEventAsync` implementation in the component is invoked.

#### StateHasChanged?

Throughout this blog post, we've seen the `StateHasChanged` method invoked quite a few times. And if you're a seasoned Blazor developer, you've probably encountered this method before! The `StateHasChanged` ([ref](https://github.com/dotnet/aspnetcore/blob/b0247ccadac4b1640b53e610e2ade926308d0cec/src/Components/Components/src/ComponentBase.cs#L98-L119)) method re-renders the component "if applicable". How do we know if we should be re-rendering the component? That's where the `ShouldRender` method comes in. `ShouldRender` is an override that allows a component to dictate whether or not it should be re-rendered passed on certain conditions. Practically, this can be used to avoid aggressive re-renders on components or to ensure that a component only ever renders once.

> Note: you might've read in the Blazor docs that a component will always render once. The `_hasNeverRenderered` condition evaluated below is what ensures this behavior. The `_hasNeverRendered` flag is `true` by default, but [is unset when the component is rendered](https://github.com/dotnet/aspnetcore/blob/b0247ccadac4b1640b53e610e2ade926308d0cec/src/Components/Components/src/ComponentBase.cs#L36-L44).

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


#### Rendering for you and me

So far, we've talked about the things like lifecycle methods or event handling, but haven't gotten into the nitty-gritty of components: how do we get actual pixels on a page? Well stay tuned, because this topic will also be covered in another blog post where we will take a look at the `Renderer` constructs in Blazor.

## Conclusion

Let's step away from the code and cover the concepts that we went through in this blog post.

* Components are only really required to implement the bare-bones `IComponent` implementation which covers how they are rendered and how their parameters set.
* The `ComponentBase` class implements the `IComponent` interface and adds additional lifecycle methods for handling state changes and events.
* `ComponentBase` implements the `IHandleEvent` interface which is responsible for re-rendering the component following the invocation of an event callback.
* Each component is associated with a `RenderHandle` and `RenderFragment` that take on the responsibility of rendering the user interface.

In the next blog post, we'll dive deeper into the code responsible for facilitating rendering in Blazor.
