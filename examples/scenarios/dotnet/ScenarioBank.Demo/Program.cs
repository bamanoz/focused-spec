using FocusedSpec.Scenarios;
using ScenarioBank.Bank;

foreach (var scenario in AccountScenarios.Suite.Scenarios)
{
    var events = new List<ExecutionEvent>();
    var actual = await ScenarioExecutor.VerifyAsync(AccountScenarios.Driver, scenario, observer: events.Add);
    Console.WriteLine($"{scenario.Name}: PASS");
    Console.WriteLine($"  GIVEN  {string.Join(", ", scenario.Given.Select(item => item.Type))}");
    Console.WriteLine($"  WHEN   {scenario.When}");
    Console.WriteLine($"  EXPECT {string.Join(", ", scenario.Expect.Select(item => item.Type))}");
    foreach (var item in events.Where(item => item.Kind == "explanation")) Console.WriteLine($"  EXPLAIN {item.Message}: {item.Data}");
    Console.WriteLine($"  ACTUAL {string.Join(", ", actual.Select(item => item.Type))}");
}
