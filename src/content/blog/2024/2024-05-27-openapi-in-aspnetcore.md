---
title: A deep dive into OpenAPI support in ASP.NET Core
---

The [OpenAPI specification](https://www.openapis.org/) is a standard for describing HTTP APIs. The standard allows developers to define the shape of APIs that can be plugged into client generators, server generators, testing tools, documentation, and more. 

> :bulb: You might've heard the term Swagger used interchangeably with OpenAPI to describe the specification and standard used to describe HTTP APIs. This document will use the term "OpenAPI" consistently to refer to the document and specification.

ASP.NET Core is a web stack for .NET and provides two main models for building HTTP-based APIs:

- Controller-based APIs that use the object-oriented style of traditional MVC (Model-View-Controller) frameworks.
- Minimal APIs that use a functional and imperative style programming model.

Throughout this document, we'll talk about ASP.NET's "code-first" integration with OpenAPI. Code-first is one of the two main models of interacting with APIs and their accompanying descriptions.

In the **code-first** model, we start with APIs that are implemented in our programming language/stack of choice and generate OpenAPI descriptions that can interop with other ecosystem tools.

In the **spec-first** model, we start by describing our APIs using the language provided by the OpenAPI specification and then feeding that description into server/client generators, testing tools, etc.

As you dive deeper into the world of OpenAPI, you'll hear lots of perspectives about whether **code-first** or **spec-first** is the right way to build APIs. Like any decision, it requires a fair bit of nuance and there's no one right approach to use in either case.

Now that we've covered the fundamentals of what OpenAPI and ASP.NET Core are, we'll move to the next section of documentation which talks about the way ASP.NET Core APIs are mapped to OpenAPI document implementations using the code-first approach.

So, let's take a deeper look at our code-first document generation flow. Let's assume that we have the following minimal API implemented in ASP.NET Core.

```csharp
var builder = WebApplication.CreateBuilder();

builder.Services.AddOpenApi();

var app = builder.Build();

app.MapOpenApi();

List<Todo> todos = [
  new Todo(1, "Write docs", false),
  new Todo(2, "Add tests", true),
  new Todo(3, "Write demo", false)
];

app.MapGet("/todos", () => todos);
app.MapPost("/todos", (Todo todo) =>
{
    todos.Add(todo);
    return Results.Created($"/todos/{todo.Id}", todo);
});
app.MapDelete("/todos", (int id) =>
{
    todos.RemoveAll(todo => todo.Id == id);
    return Results.NoContent();
});
app.MapGet("/todos/{id}", (int id) =>
{
    var todo = todos.SingleOrDefault(todo => todo.Id == id);
    return todo is not null ? Results.Ok(todo) : Results.NotFound();
});

app.Run();

public record Todo(int Id, string Title, bool IsCompleted);
```

Navigating to the `/openapi/v1.json` endpoint associated with this application gives us the OpenAPI document associated with this API.

> Note: this generated OpenAPI is a point-in-time representation. The actual generated document you see might vary depending on the version of the Microsoft.AspNetCore.OpenApi package you are using and the .NET runtime that you are targeting.

<hr/>

<details>
<summary>openapi/v1.json</summary>
<div markdown=1>
```json
{
  "openapi": "3.0.1",
  "info": {
    "title": "SampleApp | v1",
    "version": "1.0.0"
  },
  "paths": {
    "/todos": {
      "get": {
        "tags": [
          "SampleApp"
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "required": [
                      "id",
                      "title",
                      "isCompleted"
                    ],
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "integer",
                        "format": "int32"
                      },
                      "title": {
                        "type": "string"
                      },
                      "isCompleted": {
                        "type": "boolean"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "x-aspnetcore-id": "fd75263b-2390-4288-9c1b-ea1945cf2f9d"
      },
      "post": {
        "tags": [
          "SampleApp"
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "required": [
                  "id",
                  "title",
                  "isCompleted"
                ],
                "type": "object",
                "properties": {
                  "id": {
                    "type": "integer",
                    "format": "int32"
                  },
                  "title": {
                    "type": "string"
                  },
                  "isCompleted": {
                    "type": "boolean"
                  }
                }
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK"
          }
        },
        "x-aspnetcore-id": "0cbab067-6743-4f87-b2ec-995771bb4b59"
      },
      "delete": {
        "tags": [
          "SampleApp"
        ],
        "parameters": [
          {
            "name": "id",
            "in": "query",
            "required": true,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        },
        "x-aspnetcore-id": "b516e3a6-7c0f-4479-a253-6f6f805cd4e0"
      }
    },
    "/todos/{id}": {
      "get": {
        "tags": [
          "SampleApp"
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        },
        "x-aspnetcore-id": "8833c82b-d03a-4e9e-9c87-a36894ebe8fd"
      }
    }
  },
  "tags": [
    {
      "name": "SampleApp"
    }
  ]
}
```
</div>
</details>

<hr/>

So, how did we get here? Let's start by taking a look at what happens when we invoke `builder.Services.AddOpenApi` in our application. This method is responsible for registered OpenAPI-related types into our application's DI container. The core of the implementation for `AddOpenApi` looks something like this (also see [here](https://github.com/dotnet/aspnetcore/blob/a0652e0852f1dc9ea199a453efd421f6dfc04f1b/src/OpenApi/src/Extensions/OpenApiServiceCollectionExtensions.cs#L61)).

```csharp
private static IServiceCollection AddOpenApiCore(this IServiceCollection services, string documentName)
{
    services.AddEndpointsApiExplorer();
    services.AddKeyedSingleton<OpenApiComponentService>(documentName);
    services.AddKeyedSingleton<OpenApiDocumentService>(documentName);
    // Required for build-time generation
    services.AddSingleton<IDocumentProvider, OpenApiDocumentProvider>();
    // Required to resolve document names for build-time generation
    services.AddSingleton(new NamedService<OpenApiDocumentService>(documentName));
    return services;
}
```

The components that are registered here give us a good overview of the different elements that we'll be interacting with in this doc. The flow diagram below summarizes the gist of the system:

```mermaid
flowchart LR
	mvc[Controller-based API]
	minapi[Minimal API]
	defdescprov[ApiExplorer: DefaultApiDescriptionProvider]
	endpdescprov[ApiExplorer: EndpointMetadataDescriptionProvider]
	desccoll[IApiDescriptionCollection]
	compservice[[OpenApiComponentService]]
	docsvc[[OpenApiDocumentService]]
	idocprovider[[IDocumentProvider]]
	meas[Microsoft.Extensions.ApiDescription.Server]
	mvc --> defdescprov 
	minapi --> endpdescprov
	defdescprov --> desccoll
	endpdescprov --> desccoll
	desccoll --> docsvc
	idocprovider --> docsvc
	meas --> idocprovider
	compservice --> docsvc
```

Let's get started by taking a look at the first set of arrows in the system: those from "Controller-based API" to "DefaultApiDescriptionProvider" and "Minimal API" to "EndpointMetadataDescriptionProvider". To understand these arrows, we'll take a look at the first component within our system: the API Explorer.

## The API Explorer

API Explorer is the affectionate term for a set of APIs and abstractions in ASP.NET Core that provide a mechanism for introspecting APIs. The crux of API explorer's implementation is the `IApiDescriptionProvider` interface.

```csharp
public interface IApiDescriptionProvider
{
  int Order { get; }
  void OnProvidersExecuting(ApiDescriptionProviderContext context);
  void OnProvidersExecuted(ApiDescriptionProviderContext context)
}
```

Any framework built on top of ASP.NET Core can implement an `IApiDescriptionProvider` to outline how its concept of an HTTP route should map to an `ApiDescription`. 

```csharp
public class ApiDescription
{
    public ActionDescriptor ActionDescriptor { get; set; } = default!;
    public string? GroupName { get; set; }
    public string? HttpMethod { get; set; }
    public IList<ApiParameterDescription> ParameterDescriptions { get; } = new List<ApiParameterDescription>();
    public IDictionary<object, object> Properties { get; } = new Dictionary<object, object>();
    public string? RelativePath { get; set; }
    public IList<ApiRequestFormat> SupportedRequestFormats { get; } = new List<ApiRequestFormat>();
    public IList<ApiResponseType> SupportedResponseTypes { get; } = new List<ApiResponseType>();
}
```

This class allows `IApiDescriptionProvider` interface to describe the fundamental components of an HTTP request/response handler:

- The HTTP method that it supports taking request on
- The HTTP request path that it supports
- The types of inputs that it takes, both in the request body and via parameters in the route/query args/header
- The types of responses that it produces

The information captured by the `IApiDescriptionProvider` implementations can be consumed by anyone, including OpenAPI generators.

## Into OpenAPI

If you squint, the information in the `ApiDescription`s provided by `IApiDescriptionProvider` fulfill a lot of the requirements of the OpenAPI specification, but don't exactly match the shape of the spec. Enter the first responsibility of the `OpenApiDocumentService`: mapping `ApiDescription` instances to `OpenApiOperation` instances that are eventually aggregated into a top-level document.

> Note: The `OpenApiOperation` types are provided by the [Microsoft.OpenApi](https://github.com/microsoft/OpenAPI.NET) which provides a .NET-based object model for representing the OpenAPI document and serializers/deserializers for it.

In addition to mapping the information provided directly in the `ApiDescription`, the OpenAPI generator also maps information exposed in endpoint metadata. For example:

- `IEndpointNameMetadata` maps to the operation's ID.
- `ITagsMetadata` maps to the operation's tags.
- `IEndpointSummaryMetadata` maps to the operation's summary.
- `IEndpointDescriptionMetadata` maps to the operation's description.

And so on. The `OpenApiDocumentService` also addresses some of the incompatibilities between the metadata that's exposed in the `ApiDescription` and the expectations of the OpenAPI specification. Some of these quirks include:

- The `IApiDescriptionProvider` implementations for minimal APIs and MVC reflect the quirks of the model-binding behavior of those systems. For example, MVC represents binding arguments from a form differently from minimal APIs but both must map to the same functional representation in OpenAPI.
- OpenAPI expects certain defaults to be set for responses and request bodies that `IApiDescriptionProvider` implementations don't set.

Outside of those quirks and metadata mappings, the implementation of the `OpenApiDocumentService` is fairly straightforward. The other interesting aspect of OpenAPI is in JSON Schema/OpenAPI schema.

## With JSON Schemas

[JSON Schema](https://json-schema.org/) is a draft specification that allows developers to document and validate JSON data. The OpenAPI schema is a superset of the JSON schema format. In the context of OpenAPI, OpenAPI schemas are used to describe the types of inputs and outputs a given HTTP handler processes.

> Note: The relationship between JSON Schema and OpenAPI Schema varies depending on the version of the OpenAPI specification that you are targeting. OpenAPI v3.1 supports JSON Schema without any modifications. Versions of the specification outside of this one expose a superset of the features that are specified in JSON schema via OpenAPI schema.

The main responsibilities of ASP.NET Core's built-in OpenAPI support are the generation of JSON schemas from .NET types used in an API. The bulk of JSON schema generation support in ASP.NET Core's implementation is provided by the underlying JSON schema generation by System.Text.Json.

> Note: As of .NET 9 Preview 5, the implementation can be consumed via the `JsonSchemaMapper` prototype.

The OpenAPI generator implementation is responsible for:

- Adding support for validation attributes to the generated schemas
- Adding support for route constraints to parameters (that are sourced from the route)
- Mapping polymorphic schemas to the specific format required by OpenAPI
- Adding support for references local to the OpenAPI document

## Conclusion

And that's the gist of ASP.NET Core's OpenAPI support. The fundamentals of this support are enabled by:

- The flexibility and descriptiveness of the API explorer metadata layer
- The functionality exposed by System.Text.Json's schema generation
- A whole lot of massaging in between the two :sweat_smile:
