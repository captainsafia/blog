---
title: "The docs write themselves: from XML doc comments to OpenAPI specs"
description: "A deep dive into implementing XML documentation comment integration for ASP.NET Core's OpenAPI generator, exploring the technical challenges of bridging compile-time XML docs with runtime OpenAPI generation using source generators for AoT-friendly API documentation."
tags: [openapi, aspnetcore, source-generators, documentation, .net]
---

November is right around the corner, which means it's time for another release of .NET. I figured the next couple of weeks are a good time to reminisce on some of the features I built for this release. We'll talk about the features in chronological order. Active development on a .NET release usually starts in January of the release year, so January 2025, and one of the first things I took a look at was adding support for integrating XML comments into OpenAPI documents.

## The Problem Space

A brief summary of the space if you are not familiar:

- OpenAPI is a specification for describing REST APIs. It outlines semantics for describing the endpoints, payloads, and responses associated with an API, as well as examples and descriptions for each component.
- Code comments in C# code are typically formatted as XML-based code comments
- There's a history of features that integrate XML doc comments into API docs, whether those are framework API docs (such as DocFX) or REST API docs (such as Swashbuckle and NSwag).

The nice thing about XML comments is that they blend nicely into the language. One of my goals with the OpenAPI experience in ASP.NET is to make it as magical as possible. Lots of other frameworks require that you annotate your APIs with attributes or additional metadata. While this pattern is supported in ASP.NET, it's not exclusively required. In fact, there's plenty of nice affordances in the framework that mean you can just write business logic and rely on the framework to glean an understanding of the API shape that it can reflect in the OpenAPI document. For more on this infrastructure, check out my [previous blog post on how OpenAPI in ASP.NET Core works](../2024/2024-05-27-openapi-in-aspnetcore.md).

Another aspect to XML doc support is the increasing importance of natural language-based descriptors on APIs in the advent of LLMs as tools. Specifications like OpenAPI give you a nice way of intermingling structured schemas that reflect your API behavior with prose descriptions that can give LLMs (and humans!) more context.

## Implementation Overview

With those motivations in mind, let's get into the nitty-gritty of how the implementation works. Spoiler alert: if you've been keeping up with the blog you'll know that there are source generators here.

C# supports doc comments on source code that comply with an XML format that allows us to define the descriptions, parameters, response types, and exceptions, as in the doc comments for the `POST /todo` endpoint below:

```csharp
/// <summary>
/// Creates a new todo item in the system.
/// </summary>
/// <param name="todo">The todo item to create with title and description.</param>
/// <returns>The created todo item with assigned ID and creation timestamp.</returns>
/// <response code="201">Todo item was successfully created.</response>
/// <response code="400">The request payload was invalid or malformed.</response>
/// <response code="409">A todo item with the same title already exists.</response>
/// <exception cref="ArgumentNullException">Thrown when the todo parameter is null.</exception>
/// <exception cref="InvalidOperationException">Thrown when the database is unavailable.</exception>
public async Task<Created> CreateTodoAsync(CreateTodoRequest todo)
{
    if (todo == null)
        throw new ArgumentNullException(nameof(todo));
    
    var createdTodo = await _todoService.CreateAsync(todo);
    return TypedResults.Created($"/todo/{todo.Id}", createdTodo);
}
```

These doc comments are generated into a documentation file by the C# compiler that sits alongside the application assemblies. That means if I've enabled documentation file generation, my compilation will produce both a `App.dll` with compiled assembly and an `App.docs.xml` with the doc comments. For the example below, the XML file might look like this:

```xml
<?xml version="1.0"?>
<doc>
  <assembly>
    <name>TodoApi</name>
  </assembly>
  <members>
    <member name="M:TodoApi.Controllers.TodoController.CreateTodoAsync(TodoApi.Models.CreateTodoRequest)">
      <summary>
        Creates a new todo item in the system.
      </summary>
      <param name="todo">The todo item to create with title and description.</param>
      <returns>The created todo item with assigned ID and creation timestamp.</returns>
      <response code="201">Todo item was successfully created.</response>
      <response code="400">The request payload was invalid or malformed.</response>
      <response code="409">A todo item with the same title already exists.</response>
      <exception cref="T:System.ArgumentNullException">Thrown when the todo parameter is null.</exception>
      <exception cref="T:System.InvalidOperationException">Thrown when the database is unavailable.</exception>
    </member>
  </members>
</doc>
```

### Documentation IDs: The Bridge Between Compile-Time and Runtime

There are a few things to note about the structure of this document: each documented node in the syntax tree is specified with a documentation ID string that [is actually well-specified](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/documentation-comments#d42-id-string-format). The documentation IDs are unique enough that you can use them nicely to map between types that are discovered at compile-time and handled at run-time.

But I'm getting ahead of myself! The compile-time versus run-time distinction is important because the implementation makes use of source generators to discover XML comments that need to be annotated. Why do we need source generators? Because we're trying to make the OpenAPI implementation in ASP.NET Core as AoT-friendly as possible. Arbitrarily discovering XML comments for any type at runtime requires a bit of unbounded reflection that static analysis via a source generator helps us avoid.

### Discovering and Parsing XML Comments

The source generator discovers XML comments from two places:

- For the assembly under compilation, Roslyn exposes APIs for querying the documentation on symbols in the assembly directly.
- For referenced assemblies, we need to look up the XML file associated with the assembly and parse the XML ourselves.

If you're doing this kind of XML doc document processing at runtime, you're almost exclusively always having to parse the XML doc comments yourself. The fact that the source generator implementation lets us take advantage of its symbol documentation APIs is a nice side-effect of this approach. However, we still have two different ways of processing XML inputs and as they say: mo' money, mo' problems.

Once both XML sources have been explored, the source generator creates a cache that maps documentation IDs to a structured `XmlComment` type, like `Dictionary<string, XmlComment>`. Our generated code can query this dictionary to resolve XML comments that should be injected into the OpenAPI document.

### Using Interceptors for Runtime Integration

What does that generated code look like? Spoiler alert: it uses the [C# interceptors compiler feature](https://github.com/dotnet/roslyn/blob/main/docs/features/interceptors.md) which allows us to generate code that indicates that a particular callsite will be intercepted at runtime with our generated implementation of the method. In this case, we use interceptors to hook into the `AddOpenApi` method call and add transformers to the OpenAPI document that apply the XML documentation.

```csharp
builder.Services.AddOpenApi();

// Generated code that actually get's called in the line above
public static IServiceCollection AddOpenApi(this IServiceCollection services)
{
    return services.AddOpenApi("v1", options =>
    {
        options.AddSchemaTransformer(new XmlCommentSchemaTransformer());
        options.AddOperationTransformer(new XmlCommentOperationTransformer());
    });
}
```

### Runtime Transformation

At runtime, these transformers are invoked and execute the logic to lookup values in the comment cache by their documentation strings. This is actually an interesting point to hone in on because, as of writing, there is no way to generate documentation IDs for types at runtime. There's an [open issue about this on the Roslyn repo](https://github.com/dotnet/roslyn/issues/61838) that captures some interesting philosophical discussions around when it is appropriate to bleed compiler-specific behaviors into the runtime. Worth a skim!

I was able to successfully work around this implementation by using an LLM to create an API that could resolve documentation IDs for runtime types. I fed the LLM the specification for documentation IDs referenced above and a couple of sample XML files and got a decent implementation that I was able to build on top of. Having a built-in API would be nice but being able to generate something based off a spec is a good workaround.

## The Good, The Bad, and the Ugly

I'm actually really excited about the possibilities of using documentation IDs as unique identifiers that bridge statically and dynamically discovered types. As long as both implementations are faithful to the specification, you should be able to use documentation IDs as lookup keys in source-generated caches as in the case above. In some cases, this can be a helpful alternative to interception or overriding behavior at runtime or for passing state generated at compile-time to run-time APIs. I have a hypothesis about using this approach to unify the static and dynamic implementations of RequestDelegate creation for minimal APIs—but more on that when I actually have something to show. Hold me to it!

No feature is without its warts and this one has a few that bug me:

- **Interceptor limitations**: Interceptors are great but they are limited in what callsites they can intercept. One of the biggest limitations is scenarios where the method being targeted by interception is not invoked in the target assembly but in referenced assemblies. This is a very common pattern when people create wrapper helpers in separate class libraries that they reference from their application code. The typical workaround is to make sure the source generator is called in your referenced library and wrap the callsite that would be intercepted yourself in a helper method.

- **Proactive caching overhead**: The implementation is proactive about loading XmlComments into the cache. Since we don't know which types will be referenced in APIs, the implementation loads all XML comments it discovers into the cache in the event they are eventually resolved at runtime. This does mean that for applications that reference numerous packages with documentation comments, build times for the compilation and access times for the dictionary can increase. I haven't figured out a way around this yet.

- **Manual configuration for referenced assemblies**: For the scenario where documentation comments are in referenced assemblies, we require the user to explicitly pass in those XML comments as AdditionalFiles to the compilation if they are not ProjectReferences. This decision is made to mitigate the impact of resolving multiple items into the cache mentioned above. This does mean that users have to interact with MSBuild and configuration in their project file to get the desired behavior.

There's probably a few more warts that I'll learn about once the GA goes out (lolsob), but those are the structural ones that I'm eager to address in the future.

## Try It Out

If you're curious to see the implementation in action, I prepared a [sample repo](https://github.com/captainsafia/aspnet-openapi-xml) a while back that you can use to explore the support.
