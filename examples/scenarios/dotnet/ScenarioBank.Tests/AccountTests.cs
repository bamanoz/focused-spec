using Xunit;
using FocusedSpec.Scenarios;
using ScenarioBank.Bank;

namespace ScenarioBank.Tests;

public sealed class AccountTests
{
    public static IEnumerable<object[]> Scenarios => AccountScenarios.Suite.Scenarios.Select(scenario => new object[] { scenario });

    [Theory]
    [MemberData(nameof(Scenarios))]
    public async Task AllCanonicalScenariosPassAgainstTheRealAccount(Scenario<AccountEvent[], AccountCommand, AccountEvent[]> scenario)
    {
        Assert.Equal(scenario.Expect, await ScenarioExecutor.VerifyAsync(AccountScenarios.Driver, scenario));
    }

}
