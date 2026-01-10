---
title: "Anatomy of an API: the small but mighty MapOpenApi()"
description: "A deep dive into the design decisions behind ASP.NET Core's MapOpenApi() method exploring why it's modeled as an endpoint, how route templating enables YAML support, and the thoughtful details that make this tiny API so powerful."
---

I'm really proud of the OpenAPI experience in Minimal APIs, especially in comparison to REST API frameworks in other ecosystems. Because we're able to build on C#'s strong type system and .NET's rich set of APIs for introspecting runtime behavior, we can create a really magical experience that lets us derive fairly accurate OpenAPI docs from APIs without a lot of user intervention. In the following code:

```csharp
var builder = WebApplication.CreateBuilder();

builder.Services.AddOpenApi();

var app = builder.Build();

app.MapOpenApi();

app.MapPost("/todos/{id}", (int id, Todo todo)
    => TypedResults.Created($"/todos/{id}", todo));

app.Run();

record Todo(int Id, string Title, bool IsCompleted, DateTime CreatedAt);
```

The `AddOpenApi` call registers services that are required for OpenAPI document generation, including a set of providers that understand how to examine the endpoints in the app and derive structured descriptions for them (see [this earlier blog post I wrote](/2024/05/27/openapi-in-aspnetcore/)). The `MapOpenApi` method registers an endpoint that emits the OpenAPI document in JSON format. By default, the document is served at `http://localhost:{port}/openapi/v1.json`, where `v1` is the default document name. The document that you get is rich with metadata about the parameters and responses that this API produces.

![Screenshot of OpenAPI document served from local endpoint](/assets/images/2025-11-20-openapi-screencap.png)

Today, I want to hone in on the `MapOpenApi` method and talk a little bit about some of the design choices wrapped up in it. It's a small and tight API, but it's a total workhorse. Here's what its method signature in the framework looks like:

```csharp
public static IEndpointConventionBuilder MapOpenApi(
    this IEndpointRouteBuilder endpoints,
    [StringSyntax("Route")] string pattern = "/openapi/{documentName}.json")
```

Let's walk through the details of the these three lines of code.

First, why `MapOpenApi` instead of something like `UseOpenApi`? The `Map` verb typically refers to components that are modeled as endpoints in the ASP.NET Core ecosystem, whereas the `Use` verb typically refers to components that are modeled as middleware. The choice to model this as an endpoint instead of a middleware is actually pretty cool because it lets the OpenAPI document participate in all the endpoint-specific behavior that is available in ASP.NET Core's other APIs. For example, if you want to lock down your API docs behind auth? Easy. Want to cache the document so you're not regenerating it on every request? Also easy. Your code ends up being a chain of fluent calls to modify the behavior of the endpoint.

```csharp
app.MapOpenApi()
  .RequireAuthorization()
  .WithOutputCaching()
```

You might've noticed the `[StringSyntax("Route")]` attribute on the pattern parameter. That's a cute little hint to your editor that says "hey, this is a route template, maybe colorize it accordingly." So if you're staring at your code in VS Code or Visual Studio, you'll get nice syntax highlighting on the route parameters. It's one of those small touches that makes the DX a bit nicer for this API. In addition to colorization, it also opts in the parameter to a bunch of static analysis that ASP.NET Core does automatically. For example, if you provide a route pattern template that is invalid for whatever reason, you'll get a warning during build about this and be able to rectify the situation. This is part of the "shift-left" philosophy of API design, where errors and warnings happen as code is written and built, not when it is running.

The default route pattern is sensible enough that most folks won't need to change it, but if you want to customize it, there are plenty of options for you. The most important thing is making sure your route template includes a `{documentName}` parameter so the framework knows which document you're asking for. The code below lets you serve the OpenAPI document from a different route in your service.

```csharp
app.MapOpenApi("/docs/{documentName}/openapi.json");
```

Here's a fun one: we added support for emitting OpenAPI documents in YAML after the initial API shipped. Rather than polluting the API surface with a new overload or a `MapOpenApiYaml` method (gross!), I just leaned into the file extension in the route. If you change `.json` to `.yaml` in the route template, boom, you get YAML. I'm particularly proud of this because it keeps the API surface tiny while still being expressive.

```csharp
app.MapOpenApi("/docs/{documentName}/openapi.yaml");
```

And because you're calling a method to register an endpoint and not some middleware, you can call `MapOpenApi` multiple times to register different routes. If you want to serve both YAML and JSON variants of your OpenAPI documents, you just register two different endpoints with two different extensions.

```csharp
app.MapOpenApi("/docs/{documentName}/openapi.yaml");
app.MapOpenApi("/docs/{documentName}/openapi.json");
```

The beauty of this API is that it's concise and expressive without being too clever. That said, it does lean pretty heavily on understanding how the route templating system works, which might trip up folks who are new to ASP.NET Core. But honestly, the terseness works out well in practice since _most_ people are gonna be just fine with the defaults: serve a JSON document at the default route and plug it into the rest of their OpenAPI tooling.

And that's `MapOpenApi` in a nutshell. It's one of those APIs that looks deceptively simple on the surface but has a lot of thought packed into all the little details. The endpoint-based model gives you flexibility, the route templating keeps things consistent with the rest of the ecosystem, and the file extension trick for YAML support is just chef's kiss (if I do say so myself!).