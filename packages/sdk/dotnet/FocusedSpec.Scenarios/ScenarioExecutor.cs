using System.Collections;
using System.Reflection;
using System.Runtime.CompilerServices;

namespace FocusedSpec.Scenarios;

public static class ScenarioExecutor
{
    public static async ValueTask<TExpect> VerifyAsync<TSubject, TGiven, TWhen, TExpect>(
        ScenarioDriver<TSubject, TGiven, TWhen, TExpect> driver,
        Scenario<TGiven, TWhen, TExpect> scenario,
        CancellationToken cancellationToken = default,
        Action<ExecutionEvent>? observer = null)
    {
        ArgumentNullException.ThrowIfNull(driver);
        ScenarioValidation.Validate(scenario);
        if (driver.Given is null || driver.When is null) throw new ArgumentException("Driver requires Given and When operations.", nameof(driver));
        cancellationToken.ThrowIfCancellationRequested();
        var input = ((TGiven)ScenarioValidation.Clone(scenario.Given)!, (TWhen)ScenarioValidation.Clone(scenario.When)!);
        Emit(observer, new ExecutionEvent("observation", "Given", ScenarioValidation.Clone(scenario.Given)));
        Emit(observer, new ExecutionEvent("observation", "When", ScenarioValidation.Clone(scenario.When)));
        Emit(observer, new ExecutionEvent("observation", "Expect", ScenarioValidation.Clone(scenario.Expect)));
        var context = new DriverContext(scenario.Id, cancellationToken, observer);
        var subject = await driver.Given(input.Item1, context).ConfigureAwait(false);

        Exception? primary = null;
        TExpect actual = default!;
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            actual = await driver.When(subject, input.Item2, context).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            ScenarioValidation.ValidateData(actual, "Actual");
            Emit(observer, new ExecutionEvent("observation", "Actual", ScenarioValidation.Clone(actual)));
            if (!StructuralEquals(actual, scenario.Expect, new HashSet<(object, object)>(PairComparer.Instance)))
                throw new ScenarioMismatchException(scenario.Id, scenario.Name, ScenarioValidation.Clone(scenario.Expect), ScenarioValidation.Clone(actual));
        }
        catch (Exception error)
        {
            primary = error;
        }

        Exception? cleanup = null;
        if (driver.Cleanup is not null)
        {
            try
            {
                await driver.Cleanup(subject, new DriverContext(scenario.Id, CancellationToken.None, observer)).ConfigureAwait(false);
            }
            catch (Exception error)
            {
                cleanup = error;
            }
        }
        if (primary is not null && cleanup is not null) throw new AggregateException($"{scenario.Id}: execution and cleanup failed", primary, cleanup);
        if (primary is not null) System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(primary).Throw();
        if (cleanup is not null) System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(cleanup).Throw();
        return (TExpect)ScenarioValidation.Clone(actual)!;
    }

    private static void Emit(Action<ExecutionEvent>? observer, ExecutionEvent value) => observer?.Invoke(value);

    private static bool StructuralEquals(object? left, object? right, HashSet<(object, object)> visited)
    {
        if (ReferenceEquals(left, right)) return true;
        if (left is null || right is null || left.GetType() != right.GetType()) return false;
        var type = left.GetType();
        if (type.IsPrimitive || type.IsEnum || left is string or decimal or DateTime or DateTimeOffset or TimeSpan or Guid) return left.Equals(right);
        if (!type.IsValueType && !visited.Add((left, right))) return true;
        if (left is IDictionary ld && right is IDictionary rd)
        {
            if (ld.Count != rd.Count) return false;
            foreach (DictionaryEntry entry in ld)
            {
                if (!rd.Contains(entry.Key) || !StructuralEquals(entry.Value, rd[entry.Key], visited)) return false;
            }
            return true;
        }
        if (left is IEnumerable ls && right is IEnumerable rs)
        {
            var le = ls.GetEnumerator();
            var re = rs.GetEnumerator();
            while (true)
            {
                var lm = le.MoveNext();
                var rm = re.MoveNext();
                if (lm != rm) return false;
                if (!lm) return true;
                if (!StructuralEquals(le.Current, re.Current, visited)) return false;
            }
        }
        foreach (var field in type.GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
        {
            if (!StructuralEquals(field.GetValue(left), field.GetValue(right), visited)) return false;
        }
        return true;
    }

    private sealed class PairComparer : IEqualityComparer<(object, object)>
    {
        public static PairComparer Instance { get; } = new();
        public bool Equals((object, object) x, (object, object) y) => ReferenceEquals(x.Item1, y.Item1) && ReferenceEquals(x.Item2, y.Item2);
        public int GetHashCode((object, object) pair) => HashCode.Combine(RuntimeHelpers.GetHashCode(pair.Item1), RuntimeHelpers.GetHashCode(pair.Item2));
    }
}
