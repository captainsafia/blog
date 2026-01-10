---
title: Parameter optionality in Minimal APIs
---

In .NET 6 RC1, we shipped support for a new feature in Minimal APIs that allows developers to set the optionality of request parameters by using nullable annotations and default parameters to indicate which values are required and which aren't. For example, let's say you had an endpoint that generated a random number based on a seed, like so:

```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/random", (int seed, int max) => 
{
	var random = new Random(seed);
	return random.Next(0, max);
});

app.Run();
```

By default, in the scenario above, the `seed` parameter will be treated as required. That means if the user sends the following request to the endpoint:

```bash
$ http "http://localhost:5184/random"               
HTTP/1.1 400 Bad Request
Content-Length: 0
Date: Sun, 22 Aug 2021 21:52:51 GMT
Server: Kestrel
```

They'll be meet with a 400 Bad Request response. However, everything is all fine and dandy if both values are provided, though.

```bash
$ http "http://localhost:5184/random?seed=5&max=100"
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sun, 22 Aug 2021 22:06:56 GMT
Server: Kestrel
Transfer-Encoding: chunked

33
```

As it turns out, we can generate a `Random` object without providing a seed. By annotating `seed` as a nullable property, we can permit users to send requests to the endpoint without providing a `seed` property to the query.

```csharp
app.MapGet("/random", (int? seed, int max) => 
{
	var random = seed.HasValue ? new Random(seed.Value) : new Random();
	return random.Next(0, max);
});
```

In this case, both requests below are valid.

```bash
$ http "http://localhost:5184/random?max=100" 
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sun, 22 Aug 2021 22:08:16 GMT
Server: Kestrel
Transfer-Encoding: chunked

17

$ http "http://localhost:5184/random?seed=5&max=100"
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sun, 22 Aug 2021 22:08:35 GMT
Server: Kestrel
Transfer-Encoding: chunked

33
```

However, since the `max` attribute is still required, omitting that from the request will result in the 400 Bad Request error.

```bash
$ http "http://localhost:5184/random?seed=5"
HTTP/1.1 400 Bad Request
Content-Length: 0
Date: Sun, 22 Aug 2021 22:09:22 GMT
Server: Kestrel
```

In addition to nullable annotations, we can indicate that a parameter is optional by specifying a default value for the parameter.

```csharp
int GetRandom(int? seed, int max = 5)
{
    var random = seed.HasValue ? new Random(seed.Value) : new Random();
    return random.Next(0, max);
}
app.MapGet("/random", GetRandom);
```

:warning: **Note:** In the code above, the endpoint logic has been moved to a separate function since default parameters in inline lambdas are not currently supported in C#.

The change above permits the user to provide the `seed` and `max` parameters as optional within requests. All the following requests will be processed by the endpoint.

```bash
$ http "http://localhost:5184/random?seed=5&max=100"
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sun, 22 Aug 2021 22:12:58 GMT
Server: Kestrel
Transfer-Encoding: chunked

33

$ http "http://localhost:5184/random?seed=5"        
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sun, 22 Aug 2021 22:15:11 GMT
Server: Kestrel
Transfer-Encoding: chunked

1

$ http "http://localhost:5184/random"       
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sun, 22 Aug 2021 22:15:24 GMT
Server: Kestrel
Transfer-Encoding: chunked

4

$ http "http://localhost:5184/random?max=100" 
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Date: Sun, 22 Aug 2021 22:15:51 GMT
Server: Kestrel
Transfer-Encoding: chunked

95
```

In the above scenario, we were able to mark a query parameter as optional but the same principles apply to parameters in the body as well as services injected to the endpoint. So for example, let's say that we took the configuration for our random number generator as a set of arguments provided in the body of the request.

```csharp
app.MapPost("/random", (ConfigOptions? options) =>
{
    var random = options is not null ? new Random(options.Seed) : new Random();
    return random.Next(0, options?.Max ?? 100);
});

app.Run();

class ConfigOptions
{
    public int Seed { get; }
    public int Max { get; }
}
```

The above will appropriately handle requests where the the body parameters are provided and those where it isn't.

One thing to note is that the behavior is different for service parameter. For one, instead of returning a 400 status code, the endpoint will return a 500 status code depending on whether or not the service was provided. Also, due to some nuances in the parameter parsing logic, optionality is only support for services that are injected into the endpoint via an explicit reference (using the `FromService` attribute) and not those that are implicit referenced.

:spiral_notepad: The nuance here is that there is some subtlety around discerning whether the `SomeType` in `app.MapPost("/foo", (SomeType st) => ...)` is referring to a service `SomeType` or a body param that deserializes to `SomeType`.

Finally, depending on the nullability context the parameter exists in the, the behavior of this feature will differ slightly.

* Unannotated value types are always required regardless of nullability context.
* Unannotated reference types are always optional if they exist in an unknown nullability context.
* Regardless of nullability context, you can use default values to indicate that a reference or value type parameter is optional.

One final note, by default, no message will be sent in the response when a parameter fails a requiredness check. For more information on this, including current solutions, check out [this GitHub issue](https://github.com/dotnet/aspnetcore/issues/35501).

### A peak at the implementation

The rest of this article will discuss the more interesting implementation aspects of the feature. If you're interested in learning how this works behind the scenes, read on! If not, you can pause here and go play around with it.

If you've ever had to tinker with determining the nullability of parameters via reflection, you're likely familiar with having to process types at runtime for nullabiltiy annotations indicated by the `Nullable` attribute or the `NullableContext` attribute. Under the hood, this feature leverages a new API introduced in .NET 6 for processing the nullability information of a particularly type. You can read more about this new API in [the original issue](https://github.com/dotnet/runtime/issues/29723) or in [the implementation PR](https://github.com/dotnet/runtime/pull/54985).

The API exposes a `NullabilityContext` object that can be used to derive the nullability info for a certain `ParameterInfo`. The minimal APIs feature compiles the provided endpoint into a request delegate, when this happens we have access to the `ParameterInfo` using the provided reflection APIs. So we can extract information about the optionality of a PR using the following:

```csharp
private bool IsOptionalParameter(ParameterInfo parameter)
{
  NullabilityContext nullabilityContext = new();
  var nullability = nullabilityContext.Create(parameter);
  return parameter.HasDefaultValue
    || nullability.ReadState != NullabilityState.NotNull;
}
```

 When we compile the endpoint into a request delegate, we produce an intermediary `Expression` tree that is then compiled and executed when the endpoint is invoked. 

```csharp
var isOptional = IsOptionalParameter(parameter);
if (!isOptional)
{
  var checkRequiredStringParameterBlock = Expression.Block(
    Expression.Assign(argument, valueExpression),
    Expression.IfThen(Expression.Equal(argument, Expression.Constant(null)),
                      Expression.Block(
                        Expression.Assign(WasParamCheckFailureExpr, Expression.Constant(true)),
                        Expression.Call(LogRequiredParameterNotProvidedMethod,
                                        HttpContextExpr, Expression.Constant(parameter.ParameterType.Name),
                                        Expression.Constant(parameter.Name)))));
}
```

If the parameter is not optional, we add a block that confirms the parameter was provided in the request and sets `wasParamCheckFailure` to `true` which later results in a 400 response being sent to the endpoint.

For a more detailed walkthrough of the code, click through the following links to review the implementation.

1. The `CreateArgument` method processes each `ParameterInfo` object associated with a callback parameter into an argument handled in the request delegate. It has the ability to process arguments conditionally depending on if they are associated with a query param, route param, body param, or service ([ref](https://github.com/dotnet/aspnetcore/blob/2861521c83ed9c19dae5bf0de4ceceab01d8ed69/src/Http/Http.Extensions/src/RequestDelegateFactory.cs#L205)).
2. For each type of parameter that is processed we invoke the `IsOptionalParameter` check above and produce the appropriate requiredness check for each parameter type. [Here is where we do it for body params](https://github.com/dotnet/aspnetcore/blob/2861521c83ed9c19dae5bf0de4ceceab01d8ed69/src/Http/Http.Extensions/src/RequestDelegateFactory.cs#L868-L899), [here is where we do it for explicit service params](https://github.com/dotnet/aspnetcore/blob/2861521c83ed9c19dae5bf0de4ceceab01d8ed69/src/Http/Http.Extensions/src/RequestDelegateFactory.cs#L630-L634), [here is where we do it for all other params](https://github.com/dotnet/aspnetcore/blob/2861521c83ed9c19dae5bf0de4ceceab01d8ed69/src/Http/Http.Extensions/src/RequestDelegateFactory.cs#L645-L664).





