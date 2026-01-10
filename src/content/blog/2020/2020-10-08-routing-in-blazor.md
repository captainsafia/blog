---
layout: post
title: Under the hood with routing in Blazor
tags: blazor
---

A while back, I posted [a response to a user issue](https://github.com/dotnet/aspnetcore/issues/21668#issuecomment-626909464) on the ASP.NET Core repo explaining the inner workings of routing in Blazor. The response was pretty good, but I wanted to take the opportunity to flesh it out a little bit more in a blog post.

Ready?

Here goes!

Routing is a pretty fundamental part of a lot of SPA (single-page application) frameworks. React has [React Router](https://reach.tech/router/). Vue has [Vue router](https://router.vuejs.org/). Angular has [built-in support](https://angular.io/guide/router) for routing. Routers are an important aspect of SPAs, because unlike traditional websites, SPAs don't have the luxury of going to the server to fetch a new pag when the user navigates to a route.

We can break down the task of routing in a single-page application into a few key portions:

- A way to register routes and the pages that are associated with them
- A way to map a URL that a user visits to the page registered with it

This blog post will walk through these two aspects of routing as it relates to Blazor. 

If you're the visual type, the concept below outlines the different components of this system. Be warned, my concept mapping skills are rough and the rest of the blog post will have way more detail. Hopefully, that's a good incentive to continue reading! 

 <!-- Image: Concept map of routing in Blazor (ish) - blazor-routing-concept-map.jpg -->  

We'll start our exploration of routing by taking a look at the first bullet mentioned above: how do we actually define routes and associate them with pages (or more precisely, components)?

## Parsing route templates

### The TemplateParser
The magic starts in the [TemplateParser](https://github.com/dotnet/aspnetcore/blob/403bdaa1a6144d791c8ca38c112c39c7e51def17/src/Components/Components/src/Routing/TemplateParser.cs) class which interprets what the different components of a string route template are. It contains a single static method definition that processes a string representation of a template.

```csharp
internal static RouteTemplate ParseTemplate(string template)
```

In particular, it takes a route like `/students/{StudentId:int}` and splits it by `/` to get each path-separated segment. Then parses each path segment to determine whether the segment is a static value (e.g. "students") or contains a parameter (e.g. "StudentId:int"). From this parsing, it produces a [RouteTemplate](https://github.com/dotnet/aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/Routing/RouteTemplate.cs) object.

### The RouteTemplate

```csharp
internal class RouteTemplate {
    public string TemplateText { get; }
    public TemplateSegment[] Segments { get; }
    public int OptionalSegmentsCount { get; }
}
```

Each RouteTemplate object contains a set of [TemplateSegment](https://github.com/dotnet/aspnetcore/blob/403bdaa1a6144d791c8ca38c112c39c7e51def17/src/Components/Components/src/Routing/TemplateSegment.cs) objects that match to each `/`-separated segment of the route. This `TemplateSegment` provides some information about whether or not the segment is related to a `Parameter` and exposes a `Match` function that takes in an input segment and checks to see if it matches the TemplateSegment. Note that this `Match` function also extracts parameter matches.

```csharp
internal class TemplateSegment {
    public string Value { get; }
    public bool IsParameter { get; }
    public RouteConstraint[] Constraints { get; }
}
```

The `Match` function implemented in the `TemplateSegment` is invoked in the [RouteEntry](https://github.com//aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/Routing/RouteEntry.cs#L28) class.

```csharp
public bool Match(string pathSegment, out object matchedParameterValue)
```

The TL;DR of this class is that it processes a given path, like `/students/123` and finds the route that has the most number of matching templates segments. It also stores all the parameters used in the route in the `RouteContext` object.

#### A segue into constraints

Parameterized segments of routes can have constraints associated with them. For example, we can define a route like `/students/{StudentId}`, which will accept a `StudentId` parameter of any type. However, `/students/{StudentId:int}` will only accept `StudentId` parameter values that can be parsed as integer values.

A [RouteConstraint](https://github.com/dotnet/aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/Routing/RouteConstraint.cs#L10) represents a type-constraint on a parameter. The `RouteConstraint` class provides a static `Parse` method for generating a `RouteConstraint` object from a given template string.

```csharp
public static RouteConstraint Parse(string template, string segment, string constraint)
```

One other thing to note here is that we keep a cache of the recently computed `RouteConstraints`.

```csharp
private static readonly ConcurrentDictionary<string, RouteConstraint> _cachedConstraints
            = new ConcurrentDictionary<string, RouteConstraint>();
```

That means if we encounter two integer constraints in a row, for example in a route template like `/students/{ClassId:int}/{StudentId:int}`, then we will only create the integer constraint object once and reuse it for the second template segment.

### The Router
So at this point, the parameters passed in the URL are loaded into the parameter object in the route context. It's used in the [Router](https://github.com/dotnet/aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/Routing/Router.cs) component which renders the route with a `RouteData` object that contains the parameter using the `Found` render fragment.

```
<Router AppAssembly=typeof(StandaloneApp.Program).Assembly>
    <Found Context="routeData">
        <RouteView RouteData="@routeData" DefaultLayout="@typeof(MainLayout)" />
    </Found>
    <NotFound>
        <LayoutView Layout="@typeof(MainLayout)">
            <h2>Not found</h2>
            Sorry, there's nothing at this address.
        </LayoutView>
    </NotFound>
</Router>
```

The example above shows a standard `App` component setup with the `Found` render fragment. Here, you can see that this is rendering a [RouteView](https://github.com/dotnet/aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/RouteView.cs) component.

The `RouteView` can [render the page with the parameters mapped in as attributes](https://github.com/dotnet/aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/RouteView.cs#L78). The [RenderTreeBuilder](https://github.com/dotnet/aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/Rendering/RenderTreeBuilder.cs#L186) provides an `AddAttribute` API for setting these properties.

Once the attributes are set, the [ParameterView](https://github.com/dotnet/aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/ParameterView.cs) component provides functionality for extracting the parameters from the render tree. In particular, it contains a [SetParameterProperties](https://github.com/dotnet/aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/ParameterView.cs#L234) method that updates each of the parameters on the component to the values mapped by the ParameterView (which come from the RenderTree fragment which comes from the RouteView which is invoked in by the Route component).

The [ComponentProperties](https://github.com/dotnet/aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/Reflection/ComponentProperties.cs) processes the [attributes in the component](https://github.com/dotnet/aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/Reflection/ComponentProperties.cs#L226) and [updates their values accordingly](https://github.com/dotnet/aspnetcore/blob/2535bb127d4d99e7d008991aa74d8a05c946c0a5/src/Components/Components/src/Reflection/ComponentProperties.cs#L38).

> TL;DR: The process of mapping a URL parameter to a component properties is supported by shared data structures like the RouteContext and various classes/methods that build the mapping from: string URL -> parsed route -> parameter object -> parameters injected into view -> parameters mapped to properties.

## From route to render

The next aspect of routing happens when an application is running as a user navigates through the pages. This journey starts off in JavaScript land.

When Blazor is initialized on the client, we register a callback that invokes a method defined in .NET from JavaScript using interop methods ([ref](https://github.com/dotnet/aspnetcore/blob/724c2e75a7415e67f9f5ad33fc72bf55507b8d59/src/Components/Components/src/NavigationManager.cs#L202-L212)).

```js
window['Blazor']._internal.navigationManager.listenForNavigationEvents(async (uri: string, intercepted: boolean): Promise<void> => {
    await DotNet.invokeMethodAsync(
        'Microsoft.AspNetCore.Components.WebAssembly',
        'NotifyLocationChanged',
        uri,
        intercepted
    );
});
```

Where does this callback get triggered? Whenever a navigation event (aka [popstate](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event)) is triggered in the browser ([ref](https://github.com/dotnet/aspnetcore/blob/724c2e75a7415e67f9f5ad33fc72bf55507b8d59/src/Components/Web.JS/src/Services/NavigationManager.ts#L28)), we dispatch the registered callback which eventually calls `Microsoft.AspNetCore.Components.WebAssembly.NotifyLocationChanged`.

```js
window.addEventListener('popstate', () => notifyLocationChanged(false));
```

The `NotifyLocationChanged` method in turns calls `SetLocation` on the `WebAssemblyNavigationManager` instance ([ref](https://github.com/dotnet/aspnetcore/blob/648c15dbe90fb8c113f7c6b4adeb40d9e10494f6/src/Components/WebAssembly/WebAssembly/src/Infrastructure/JSInteropMethods.cs#L24-L28)).

```csharp
[JSInvokable(nameof(NotifyLocationChanged))]
public static void NotifyLocationChanged(string uri, bool isInterceptedLink)
{
    WebAssemblyNavigationManager.Instance.SetLocation(uri, isInterceptedLink);
}
```

#### Another segue into NavigationManager

The NavigationManager is a shared concept across both Blazor Server and Blazor WebAssembly. The NavigationManager is registered as a dependency in the Blazor server application and serves as a mediator between the navigation events that occur in the browser and the the follow-on actions that occur in Blazor.

The `SetLocation` method invoke above in turn calls the [NotifyLocationChanged](https://github.com/dotnet/aspnetcore/blob/648c15dbe90fb8c113f7c6b4adeb40d9e10494f6/src/Components/WebAssembly/WebAssembly/src/Services/WebAssemblyNavigationManager.cs#L25-L290) method in the base [NavigationManager](https://github.com/dotnet/aspnetcore/blob/648c15dbe90fb8c113f7c6b4adeb40d9e10494f6/src/Components/Components/src/NavigationManager.cs#L202-L212).

```csharp
protected void NotifyLocationChanged(bool isInterceptedLink)
{
    try
    {
        _locationChanged?.Invoke(this, new LocationChangedEventArgs(_uri, isInterceptedLink));
    }
    catch (Exception ex)
    {
        throw new LocationChangeException("An exception occurred while dispatching a location changed event.", ex);
    }
}
```

When the `NotifyLocationChanged` method is called, it invokes the currently registered event handlers in the `_locationChanged` property.

Now that we're here, we need to go back to the `Router` class to trace how the `_locationChanged` event handlers are registered.

When the Router component is attached to a render handle, a new event handler is registered on the `NavigationManager.OnLocationChanged` event handler ([ref](https://github.com/dotnet/aspnetcore/blob/648c15dbe90fb8c113f7c6b4adeb40d9e10494f6/src/Components/Components/src/Routing/Router.cs#L60-L67)).

```csharp
public void Attach(RenderHandle renderHandle)
{
    _logger = LoggerFactory.CreateLogger<Router>();
    _renderHandle = renderHandle;
    _baseUri = NavigationManager.BaseUri;
    _locationAbsolute = NavigationManager.Uri;
    NavigationManager.LocationChanged += OnLocationChanged;
}
```

The [OnLocationChanged](https://github.com/dotnet/aspnetcore/blob/648c15dbe90fb8c113f7c6b4adeb40d9e10494f6/src/Components/Components/src/Routing/Router.cs#L156) method is responsible for calling the [Refresh](https://github.com/dotnet/aspnetcore/blob/648c15dbe90fb8c113f7c6b4adeb40d9e10494f6/src/Components/Components/src/Routing/Router.cs#L115) method on the router.

The `Router.Refresh` method is one of my favorite types of code to look at. It's a few pieces of code but it brings together a lot of concepts across routing and rendering in Blazor.

We start off by calling `RefreshRouteTable` ([ref](https://github.com/dotnet/aspnetcore/blob/593005230fc9900564a74e38112bfb1133932679/src/Components/Components/src/Routing/Router.cs#L167)) which computes the `RouteTable` associated with the component. The [RouteTable](https://github.com/dotnet/aspnetcore/blob/593005230fc9900564a74e38112bfb1133932679/src/Components/Components/src/Routing/RouteTable.cs) is a list of `RouteEntry`s that are generated by iterating through each routeable component in the application assembly (e.g. anything with `@page /route/here` in it) and computing an entry for it by using the `TemplateParser`. `RouteEntry` is a new data model in our routing vernacular but it's rather succinct under the hood.

```cs
class RouteEntry {
    public RouteTemplate Template {get; }
    public string[] UnusedRouteParameterNames { get; }
    public Type Handler { get; }
    internal void Match(RouteContext context);
}
```

It encapsulates the `RouteTemplate` object that we already know and love. It includes a `Handler` that will execute whenever the route is matched. And finally, it includes a `Match` function which will evaluate if the current URL matches the route entry and the set the handler and parameter values appropriately in the `RouteContext`.

There's a few key concepts that we can pull out from the `RouteTable` concept:

* Routes in Blazor have a precedence that is codified in the `RouteComparison` comparator method ([ref](https://github.com/dotnet/aspnetcore/blob/593005230fc9900564a74e38112bfb1133932679/src/Components/Components/src/Routing/RouteTableFactory.cs#L115)). This is where we enforce certain things like literal routes being more specific than parameter routes and longer routes being more specific than shorter routes.
* The `Handler`'s `Type` allows us to flexibly use any Component that is a descendant of `IComponent` as the handler for our routing.


Stepping back into the `Refresh` method in the `Router`, we request the current URL from the navigation manager.

```csharp
var locationPath = NavigationManager.ToBaseRelativePath(_locationAbsolute);
locationPath = StringUntilAny(locationPath, _queryOrHashStartChar);
```

Then, we create a `RouteContext` object from the current location.

```csharp
var context = new RouteContext(locationPath);
```

The `RouteContext` object maintains the relevant state for the current route, in particular the route template, the handler associated with the route, and the parameters extracted from the route. Once the context object is created, we call the `Route` method on the `RouteTable`. This method finds the route that is the closest match for the provided URL, it registers the parameters associated with this route in the `context.Parameters` object and sets the component associated with the route in the `context.Handler` object.

```csharp
Routes.Route(context);
```

Once the "routing" has happened we render the component and parameters that were extracted during routing.

```csharp
if (context.Handler != null)
{
    if (!typeof(IComponent).IsAssignableFrom(context.Handler))
    {
        throw new InvalidOperationException($"The type {context.Handler.FullName} " +
            $"does not implement {typeof(IComponent).FullName}.");
    }

    Log.NavigatingToComponent(_logger, context.Handler, locationPath, _baseUri);

    var routeData = new RouteData(
        context.Handler,
        context.Parameters ?? _emptyParametersDictionary);
    _renderHandle.Render(Found(routeData));
}
```

1. User opens a Blazor app. The navigation callbacks are registered on the client.
1. User navigates to a location via a link.
1. Browser dispatches a `popstate` event.
1. The NotifyLocationChanged static method is invoked via JS interop.
1. The NotifyLocationChanged static method calls the `SetLocation` method on the WebAssemblyNavigationManager instance.
1. The `SetLocation` method updates the current URI and calls the `NotifyLocationChanged` method on the `NavigationManager` class.
1. The `NotifyLocationChanged` method invokes the `_locationChanged` event handler.
1. The `OnLocationChanged` event handler registered by the `Router` is invoked.
1. The `Refresh` method in the route computes the route table if it has not already been computed.
1. The `Refresh` method in the route finds the component associated with the route and renders it on with its parameters.

And viola! This blog post covered the codepaths for the `NavigationManager` in the Blazor WebAssembly implementation. There's a similar codepath for the Blazor Server implementation, managed by the `RemoteNavigationManager`.

## Conclusion

OK! I think I've covered all the relevant bits with regard to routing in Blazor here. If there's anything I missed or anything that's still unclear, do let me know [on Twitter](https://twitter.com/captainsafia). To summarize what we covered:

- The task of routing in a SPA can be roughly divided into two tasks: computing the available routes in an application and rendering the appropriate components when navigation occurs.
- Blazor's routing implementation takes advantage of context objects, dependency injection, and language interop to make the magic work.