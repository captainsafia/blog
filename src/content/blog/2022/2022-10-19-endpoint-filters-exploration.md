---
title: A deep dive into endpoint filters in ASP.NET Core 7
---

One of the features that I worked on as part of the ASP.NET Core 7 release was support for endpoint filters in minimal APIs. I recently shared some of the internals of the implementation at a recent Ignite presentation, but I figured I would share the insights in a blog as well. If you're more of a visual or audio learner, you might find [the video presentation](https://aka.ms/Ignite2022Dev/BRK206H) helpful.

Heads up: this is an advanced blog post and assumes that you are familiar with ASP.NET and minimal APIs.

Let's get started with a quick overview of what endpoint filters are. Endpoint filters are similar to MVC's action filters in the sense that they allow you to introspect and modify parameters and also intercept responses issued by a request. However, they are designed to work on the endpoints that are the core primitive of ASP.NET's routing logic, as opposed to the controller-specific action filters.

With that in mind, let's take a look at an example of a route endpoint with an endpoint filter.

```csharp
app.MapGet("/hello/{name}", (string name) => $"Hello {name}!")
    .AddEndpointFilterFactory((context, next) =>
    {
        var parameters = context.MethodInfo.GetParameters();
        // Only operate handlers with a single argument
        if (parameters.Length == 1 &&
            parameters[0] is ParameterInfo parameter &&
            parameter.ParameterType == typeof(string))
        {
            return invocationContext =>
            {
                // Map the first string argument we
                // receive to an upper-case string
                var modifiedArgument = invocationContext
                    .GetArgument<string>(0)
                    .ToUpperInvariant();
                invocationContext.Arguments[0] = modifiedArgument;
                return next(invocationContext);
            };
        }

        return invocationContext => next(invocationContext);
    });
```

There's a couple of things that we will want to observe here:

- We're invoking a `AddEndpointFilterFactory` method that appears to take a context parameter, a next parameter, and returns a delegate.
- There's another context referenced in that delegate, referred to as the `invocationContext`.
- The context in the factory appears to give us access to a `MethodInfo` that we can introspect to analyze the signature of the handler. In this case, we're able to examine that it processes a single parameter that happens to be a string.

There's a handful of key concepts that are introduced here that we will dig into further across the rest of the blog post. For now, I want to dive a little bite more into the `AddEndpointFilterFactory` method as a gateway to explore the rest of the implementation of filters here. The `AddEndpointFilterFactory` is implemented [exactly as follows](https://github.com/dotnet/aspnetcore/blob/3c36e1643045d8c7baebece79ccd901321dfe5f2/src/Http/Routing/src/Builder/EndpointFilterExtensions.cs#L110-L118):

```csharp
    public static TBuilder AddEndpointFilterFactory<TBuilder>(this TBuilder builder, Func<EndpointFilterFactoryContext, EndpointFilterDelegate, EndpointFilterDelegate> filterFactory)
        where TBuilder : IEndpointConventionBuilder
    {
        builder.Add(endpointBuilder =>
        {
            endpointBuilder.FilterFactories.Add(filterFactory);
        });

        return builder;
    }
```

The signature of this method validates the observations that we saw earlier about the inputs/returns of filter factories. That `context` object we interacted with earlier is actually an `EndpointFilterFactoyContext`. Both the `next` and the delegate returned from the filter factory, are `EndpointFilterDelegate`s which have the following signature:

```csharp
public delegate ValueTask<object?> EndpointFilterDelegate(EndpointFilterInvocationContext context);
```

Here, we see our second context type: the `EndpointFilterInvocationContext`. We'll also note that `EndpointFilterDelegate`s must return a `ValueTask<object?>`.

The `AddEndpointFilterFactory` exposes us to another key element, the fact that the `FilterFactories` are stored in the endpoint builder. More specifically, the `FilterFactories` sequence is a required property of the base [`EndpointBuilder`](https://github.com/dotnet/aspnetcore/blob/afeab33afa4d81d3799dd665d6c1f47618815791/src/Http/Http.Abstractions/src/Extensions/EndpointBuilder.cs).

```csharp
public abstract class EndpointBuilder
{
      public IList<Func<EndpointFilterFactoryContext, EndpointFilterDelegate, EndpointFilterDelegate>> FilterFactories => _filterFactories ??= new();
}
```

This is important to note because it means that filter factories don't necessarily have to be associated with endpoints that are derived from route handlers, but endpoints mapped from controller actions or Razor pages as well.

The fact that filter factories are registered on the builder indicates that they might be involved with endpoint construction in some way, and indeed they are. Filter factories participate in endpoint construction because they affect the `RequestDelegate` that is constructed from the route handler provided to the `MapAction` call. In the scenario above, the route handler refers to the lambda passed in to `MapGet` that has the following signature:

```csharp
(string name) => string;
```

ASP.NET's routing infrastructure is designed to work with RequestDelegates that have the following signature:

```csharp
(HttpContext context) => Task;
```

In ASP.NET, this conversion is supported by a component called the `RequestDelegateFactory`. The `RequestDelegateFactory`, affectionately called RDF from here on out, is responsible for generating code (using LINQ) expressions around the route handler. 

Before we dive into what the RDF does, let's talk about where it comes into play. Let's say that you have an application that looks like this:

```csharp
var app = WebApplication.Create(args);

app.MapGet("/", () => "Hello from the home page!");
app.MapGet("/hello/{name}", (string name) => $"Hello {name}!");

app.Run();
```

Each `MapGet` invocation will add the route handler to the endpoint data source associated with the builder ([ref](https://github.com/dotnet/aspnetcore/blob/afeab33afa4d81d3799dd665d6c1f47618815791/src/Http/Routing/src/Builder/EndpointRouteBuilderExtensions.cs#L407)). When the user visits a route for the first time after the application has run, ASP.NET's routing infratructure will issue a request to all endpoint data sources to resolve their endpoints. This resolution happens once at the first instance of routing and is cached for the remainder of the application's lifetime. When the endpoints are resolved for the first time, the framework will construct an endpoint with a `RequestDelegate` out of the route handler. This is the point where RDF is invoked.

Now that we know where RDF gets invoked, we can go into a little bit of depth about what it does.

1. Examines the parameters consumed by the route handler and those defined in the route pattern and emits **parameter binding** code that resolves the best matches for each parameter from the HttpContext. For example, in the code sample above, we observe that the route parameter is defined in the route handler and in the route pattern. The RDF generates code that will derive the parameter from the `HttpContext.Request.RouteValues` dictionary. Parameter binding logic captures resolution of parameters based on explicit attributes, like `[FromRoute]` or `[FromQuery]` and special handling for values like `ClaimsPrincipal` and `CancellationToken`.
2. When filters are present, the users route handler is mapped to a handler that accepts an `EndpointFilterInvocationContext` and returns a `ValueTasik<object>`. This is done so that the route handler can be plugged into the chain of invocations that is built to include the filters.
3. The RDF enumerates the list of filter factories in LIFO order so that the last filter added to a route gets invoked closest to the route handler. This "nested doll" invocation pattern is similar to the invocation pattern that gets used for middlewares. At the end of this, we have a filtered invocation pipeline that takes the `EndpointFilterInvocationContext`, calls all the filters, and then calls the route handler.
4. The `EndpointFilterInvocationContext` is constructed from the `HttpContext` and the parameters bound from step #1.
5. The invocation context produced in #4 is passed to the invocation pipeline constructed in #3 and the returned `ValueTask<object>` is written to the response.
6. A lambda that captures the LINQ expressions generated from #1-#6 is compiled and returned to the endpoinr builder for construction of the endpoint.

And there you have it! Now, we've essentially decorated the route handler associated with an endpoint with all the filters and passed it in for invocation at runtime.
