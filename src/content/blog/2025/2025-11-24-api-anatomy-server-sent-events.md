---
title: "Anatomy of an API: three ways to stream with ServerSentEvents()"
description: "A blog post exploring why minimal API's TypedResults.ServerSentEvents() has three different overloads, what each one does, and how to avoid mixing them up when you're streaming data to clients."
---

Last week, I started dissecting some of the APIs that I've worked on over the past year. Today's blog post is a continuation of that, with a focus on the API introduced to minimal APIs this year to support stream Server-Sent Events.

If you're not familiar with [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events), or SSE as it is often abbreviated, it's a web standard that allows servers to push data to clients over a single HTTP connection. Unlike WebSockets, which require a bidirectional connection, SSE is a one-way street: the server sends data and the client receives it. The protocol is dead simple: it's just a stream of `text/event-stream` responses where each event consists of a few text fields (like `data:`, `event:`, and `id:`) separated by newlines.

```
data: Heart Rate: 72 bpm
event: heartRate

data: Heart Rate: 81 bpm
event: heartRate

data: Heart Rate: 67 bpm
event: heartRate
```

SSE is a pretty old standard as things stand (it's been around since [HTML5](https://html.spec.whatwg.org/multipage/server-sent-events.html)), but it got some renewed attention recently due to the prominence it gained in the [Model Context Protocol specification](https://modelcontextprotocol.io/docs/getting-started/intro). From my understanding, recent versions of the spec have moved away from relying on Server-Sent Events, but nonetheless their charm has been rediscovered. They're particularly useful for things like real-time dashboards, live feeds, progress updates, or any scenario where you need to stream data from the server without the overhead of polling or maintaining a full WebSocket connection.

Earlier this year, we went through the work of introducing an SSE result type that minimal APIs could expose. The idea was that the implementation would allow users to quickly start an SSE stream from an API endpoint. Instead of having to manually set headers, manage the response stream, and format events according to the SSE protocol, you could just return an `IAsyncEnumerable` and let the framework handle all the plumbing. Here's what that looks like in practice:

```csharp
var app  = WebApplication.Create();

app.MapGet("/string-item", (CancellationToken cancellationToken) =>
{
    async IAsyncEnumerable<string> GetHeartRate(
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            var heartRate = Random.Shared.Next(40, 100);
            yield return $"Heart Rate: {heartRate} bpm";
            await Task.Delay(2000, cancellationToken);
        }
    }

    return TypedResults.ServerSentEvents(GetHeartRate(cancellationToken), eventType: "heartRate");
});
```

If you hit the `/string-item` endpoint with a client that supports processing SSE, you should get an output similar to the one that I shared in the example at the top.

Like many things in minimal APIs, there are multiple overloads of the `ServerSentEvents` method that are meant to provide convenience over the different modes of interacting with the API. For this one, there are three overloads total:

```csharp
public static ServerSentEventsResult<string> ServerSentEvents(
    IAsyncEnumerable<string> values, 
    string? eventType = null) { }

public static ServerSentEventsResult<T> ServerSentEvents<T>(
    IAsyncEnumerable<SseItem<T>> values) { }

public static ServerSentEventsResult<T> ServerSentEvents<T>(
    IAsyncEnumerable<T> values, 
    string? eventType = null) { }
```

Method overloads are fantastic tools for providing a well-fit experience for users interacting with the same API in different ways. The beauty of these three overloads is that they're carefully designed to accommodate different usage patterns while staying consistent with the underlying [`SseItem` type](https://learn.microsoft.com/en-us/dotnet/api/system.net.serversentevents.sseitem-1?view=net-10.0) that is ultimately used for the serialization and formatting of the payload when it is sent over the network. Let's walk through each of the overloads and what problem they solve.

The first overload handles strings specially because they're such a common case. Rather than forcing strings through JSON serialization (which would wrap them in quotes and escape special characters), this overload uses the `SseFormatter` APIs to write strings directly to the response stream. This makes the simplest case, streaming plain text updates, as ergonomic as possible.

Let's get into the last two overloads, which is where things get interesting. The overload that accepts `IAsyncEnumerable<SseItem<T>>` gives you fine-grained control over each event's metadata. You can set event types, IDs, retry intervals, and more on a per-event basis. The overload that accepts `IAsyncEnumerable<T>` is for when you want convenience: just yield your objects and let the framework wrap them in an `SseItem` for you. Less control, but more convenience.

The tradeoff here is that when you're working with these two overloads, you need to be mindful about where you specify metadata like the event type. Let's look at the code below where we return a stream of `SseItem<Todo>` and provide an event type in the call to `TypedResults.ServerSentEvents`. What happens here? Which overload gets hit?


```csharp
app.MapGet("/todos/stream", async (CancellationToken ct) =>
{
    async IAsyncEnumerable<SseItem<Todo>> GetTodos([EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var todos = await GetTodosFromDatabase();
        foreach (var todo in todos)
        {
            yield return new SseItem<Todo>(todo);
        }
    }

    return TypedResults.ServerSentEvents(GetTodos(ct), eventType: "todo-created");
});
```

This hits the third overload: the one that expects unwrapped values. Because you're already yielding `SseItem<Todo>`, the C# compiler sees `IAsyncEnumerable<SseItem<Todo>>` and matches it to the generic overload that accepts `IAsyncEnumerable<T>`. Those items will get re-wrapped in another `SseItem`, and the `eventType` parameter you passed will apply to the outer wrapper, not to the `SseItem` instances you constructed. This probably isn't what you intended! There are two ways to get the behavior you want, depending on whether you prefer convenience or control.

For convenience, return plain `Todo` objects from your stream and let the framework handle the wrapping:

```csharp
app.MapGet("/todos/stream", async (CancellationToken ct) =>
{
    async IAsyncEnumerable<Todo> GetTodos([EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var todos = await GetTodosFromDatabase();
        foreach (var todo in todos)
        {
            yield return todo;
        }
    }

    return TypedResults.ServerSentEvents(GetTodos(ct), eventType: "todo-created");
});
```

Or, pass the event type directly in the _constructor_ of the `SseItem` that you're providing.

```csharp
app.MapGet("/todos/stream", async (CancellationToken ct) =>
{
    async IAsyncEnumerable<SseItem<Todo>> GetTodos([EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var todos = await GetTodosFromDatabase();
        foreach (var todo in todos)
        {
            yield return new SseItem<Todo>(todo, eventType: "todo-created");
        }
    }

    return TypedResults.ServerSentEvents(GetTodos(ct));
});
```

The key insight here is understanding which overload you're targeting based on what you're yielding. If you're yielding `SseItem<T>`, you're taking control of the metadata, so don't pass event type as a parameter. If you're yielding plain `T` objects, you're delegating to the framework, so pass your metadata as parameters to the method call.

You might be asking yourself: why does event type get special treatment as an optional parameter on these methods? Why not expose things like the ID and reconnection interval as parameters as well? This is where we want to strike a balance between commonality and convenience. You're more likely to want to set the event type when streaming data than other details like reconnection intervals or IDs, so it gets elevated to the top-level API surface.

So, stepping back, is this the perfect design? No API ever is. But this approach reflects a classic API design tradeoff: we could have created separate methods with more explicit names (like `ServerSentEventsWithItems` and `ServerSentEventsWithValues`), but that would clutter the API surface and make the common cases more verbose. We could have avoided overloads entirely and forced everyone to use `SseItem<T>`, but that would sacrifice the convenience of the simple case. Instead, we opted for overloads that let you choose your level of control, with the expectation that you'll understand the distinction between yielding wrapped vs. unwrapped values.

The overloads serve a real purpose: they make the simple cases simple (streaming strings or POCOs with a single event type) while keeping the complex cases possible (per-event metadata control). And honestly, once you understand the pattern, it becomes pretty intuitive. It also underscores a key design principle: make the easy things easy and allow users to grow into more complex scenarios as their needs evolve.
