using FocusedSpec.Scenarios;

namespace FocusedSpec.Scenarios.Tests;

public sealed class ScenarioTests
{
    [Fact]
    public async Task ExecutesRealDriverAndReturnsTypedActual()
    {
        var scenario = new Scenario<int, int, int>("deposit", "Deposit", 100, 25, 125);
        var driver = new ScenarioDriver<int, int, int, int>
        {
            Given = (value, _) => ValueTask.FromResult(value),
            When = (subject, command, _) => ValueTask.FromResult(subject + command),
        };
        Assert.Equal(125, await ScenarioExecutor.VerifyAsync(driver, scenario));
    }

    [Fact]
    public async Task MismatchRetainsIdentityAndExpectedActualSnapshots()
    {
        var scenario = new Scenario<int, int, int>("withdraw", "Exact amount", 5000, 4000, 1000);
        var driver = new ScenarioDriver<int, int, int, int>
        {
            Given = (value, _) => ValueTask.FromResult(value),
            When = (_, _, _) => ValueTask.FromResult(999),
        };
        var error = await Assert.ThrowsAsync<ScenarioMismatchException>(async () => await ScenarioExecutor.VerifyAsync(driver, scenario));
        Assert.Equal("withdraw", error.ScenarioId);
        Assert.Equal(1000, error.Expected);
        Assert.Equal(999, error.Actual);
    }

    [Fact]
    public async Task TypeAndNullEmptyDifferencesAreNotEqual()
    {
        var integer = new Scenario<object, object, object>("types", "Types", new object(), new object(), 1);
        var wrongType = new ScenarioDriver<object, object, object, object>
        {
            Given = (_, _) => ValueTask.FromResult<object>(new object()),
            When = (_, _, _) => ValueTask.FromResult<object>(1L),
        };
        await Assert.ThrowsAsync<ScenarioMismatchException>(async () => await ScenarioExecutor.VerifyAsync<object, object, object, object>(wrongType, integer));

        var collections = new Scenario<object, object, string[]?>("collections", "Null and empty differ", new object(), new object(), null);
        var empty = new ScenarioDriver<object, object, object, string[]?>
        {
            Given = (_, _) => ValueTask.FromResult<object>(new object()),
            When = (_, _, _) => ValueTask.FromResult<string[]?>(Array.Empty<string>()),
        };
        await Assert.ThrowsAsync<ScenarioMismatchException>(async () => await ScenarioExecutor.VerifyAsync<object, object, object, string[]?>(empty, collections));
    }

    [Fact]
    public async Task InvalidSuiteDoesNotInvokeDriver()
    {
        var suite = new ScenarioSuite<int, int, int>([
            new("same", "First", 1, 1, 2),
            new("same", "Second", 1, 1, 2),
        ]);
        Assert.Throws<ArgumentException>(() => ScenarioValidation.Validate(suite));
        var scenario = new Scenario<double, int, int>("bad", "Bad", double.NaN, 1, 2);
        var called = false;
        var driver = new ScenarioDriver<int, double, int, int>
        {
            Given = (value, _) => { called = true; return ValueTask.FromResult((int)value); },
            When = (subject, value, _) => ValueTask.FromResult(subject + value),
        };
        await Assert.ThrowsAsync<ArgumentException>(async () => await ScenarioExecutor.VerifyAsync(driver, scenario));
        Assert.False(called);
    }

    [Fact]
    public async Task CleanupRunsOnceAndPreservesPrimaryAndReleaseFailures()
    {
        var scenario = new Scenario<int, int, int>("cleanup", "Both failures", 1, 1, 2);
        var calls = 0;
        var driver = new ScenarioDriver<int, int, int, int>
        {
            Given = (value, _) => ValueTask.FromResult(value),
            When = (_, _, _) => ValueTask.FromResult(3),
            Cleanup = (_, _) => { calls++; throw new InvalidOperationException("release failed"); },
        };
        var error = await Assert.ThrowsAsync<AggregateException>(async () => await ScenarioExecutor.VerifyAsync(driver, scenario));
        Assert.Equal(2, error.InnerExceptions.Count);
        Assert.IsType<ScenarioMismatchException>(error.InnerExceptions[0]);
        Assert.Equal("release failed", error.InnerExceptions[1].Message);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task CancellationStillRunsCleanupAndCannotPassMatchingResult()
    {
        using var source = new CancellationTokenSource();
        var scenario = new Scenario<int, int, int>("cancel", "Cancelled", 1, 1, 2);
        var cleanupCalled = false;
        var driver = new ScenarioDriver<int, int, int, int>
        {
            Given = (value, _) => ValueTask.FromResult(value),
            When = (_, _, _) => { source.Cancel(); return ValueTask.FromResult(2); },
            Cleanup = (_, context) => { cleanupCalled = !context.CancellationToken.IsCancellationRequested; return ValueTask.CompletedTask; },
        };
        await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => await ScenarioExecutor.VerifyAsync(driver, scenario, source.Token));
        Assert.True(cleanupCalled);
    }

    [Fact]
    public async Task EventsAreOptionalOrderedAndIndependentSnapshots()
    {
        var scenario = new Scenario<Dictionary<string, int>, int, Dictionary<string, int>>(
            "events", "Snapshots", new() { ["balance"] = 5 }, 2, new() { ["balance"] = 7 });
        var driver = new ScenarioDriver<Dictionary<string, int>, Dictionary<string, int>, int, Dictionary<string, int>>
        {
            Given = (given, _) => ValueTask.FromResult(given),
            When = (subject, command, context) =>
            {
                context.Explain("deposit", new { amount = command });
                subject["balance"] += command;
                return ValueTask.FromResult(new Dictionary<string, int> { ["balance"] = 8 });
            },
        };
        var events = new List<ExecutionEvent>();
        var mismatch = await Assert.ThrowsAsync<ScenarioMismatchException>(async () => await ScenarioExecutor.VerifyAsync(driver, scenario, observer: events.Add));
        Assert.Equal(7, ((Dictionary<string, int>)mismatch.Expected!)["balance"]);
        Assert.Equal(8, ((Dictionary<string, int>)mismatch.Actual!)["balance"]);
        Assert.Equal(new[] { "Given", "When", "Expect" }, events.Take(3).Select(value => value.Name));
        Assert.Equal("explanation", events[3].Kind);
        Assert.Equal("Actual", events[4].Name);
        Assert.Equal(8, ((Dictionary<string, int>)events[4].Value!)["balance"]);
        ((Dictionary<string, int>)events[0].Value!)["balance"] = 99;
        Assert.Equal(5, scenario.Given["balance"]);
    }

    private sealed record NestedData(List<int> Values);

    [Fact]
    public async Task NestedMutableValuesRemainIsolatedFromDriverAndCleanup()
    {
        var scenario = new Scenario<NestedData, int, NestedData>("nested", "Nested snapshots", new([1]), 2, new([1]));
        var driver = new ScenarioDriver<NestedData, NestedData, int, NestedData>
        {
            Given = (value, _) => { value.Values.Add(2); return ValueTask.FromResult(value); },
            When = (subject, _, _) => ValueTask.FromResult(subject),
            Cleanup = (subject, _) => { subject.Values.Clear(); return ValueTask.CompletedTask; },
        };
        var error = await Assert.ThrowsAsync<ScenarioMismatchException>(async () => await ScenarioExecutor.VerifyAsync(driver, scenario));
        Assert.Equal(new[] { 1 }, scenario.Given.Values);
        Assert.Equal(new[] { 1 }, scenario.Expect.Values);
        Assert.Equal(new[] { 1 }, ((NestedData)error.Expected!).Values);
        Assert.Equal(new[] { 1, 2 }, ((NestedData)error.Actual!).Values);
    }
}
