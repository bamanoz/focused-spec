package specifications

import (
	"context"
	"reflect"
	"slices"
	"testing"

	scenarios "github.com/bamanoz/focused-spec/packages/sdk/go"
)

func TestAccountScenarios(t *testing.T) {
	if err := scenarios.ValidateSuite(Account); err != nil {
		t.Fatal(err)
	}
	for _, scenario := range Account.Scenarios {
		scenario := scenario
		t.Run(scenario.Name, func(t *testing.T) {
			if _, err := scenarios.VerifySpecification(context.Background(), AccountDriver, scenario); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestAccountMessageRoundtrips(t *testing.T) {
	before := slices.Clone(Account.Scenarios)
	for index := range before {
		before[index].Given = slices.Clone(before[index].Given)
		before[index].Expect = slices.Clone(before[index].Expect)
	}
	if err := VerifySerialization(); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(Account.Scenarios, before) {
		t.Fatal("serialization rewrote canonical declarations")
	}
}
