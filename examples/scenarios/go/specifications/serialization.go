package specifications

import (
	"fmt"
	"reflect"
	"slices"

	"example.com/scenario-bank/bank"
)

// VerifySerialization roundtrips every application message authored by the
// canonical account suite. It does not prepare or execute the account driver.
func VerifySerialization() error {
	for _, scenario := range Account.Scenarios {
		givenBefore := slices.Clone(scenario.Given)
		expectBefore := slices.Clone(scenario.Expect)
		whenBefore := scenario.When

		for index, event := range scenario.Given {
			if err := roundtripEvent(event); err != nil {
				return fmt.Errorf("%s Given[%d]: %w", scenario.ID, index, err)
			}
		}
		if err := roundtripCommand(scenario.When); err != nil {
			return fmt.Errorf("%s When[0]: %w", scenario.ID, err)
		}
		for index, event := range scenario.Expect {
			if err := roundtripEvent(event); err != nil {
				return fmt.Errorf("%s Expect[%d]: %w", scenario.ID, index, err)
			}
		}

		if !reflect.DeepEqual(scenario.Given, givenBefore) || !reflect.DeepEqual(scenario.When, whenBefore) || !reflect.DeepEqual(scenario.Expect, expectBefore) {
			return fmt.Errorf("%s: codec mutated a canonical message", scenario.ID)
		}
	}
	return nil
}

func roundtripCommand(original bank.Command) error {
	encoded, err := bank.EncodeCommand(original)
	if err != nil {
		return fmt.Errorf("encode: %w", err)
	}
	decoded, err := bank.DecodeCommand(encoded)
	if err != nil {
		return fmt.Errorf("decode: %w", err)
	}
	if !reflect.DeepEqual(decoded, original) {
		return fmt.Errorf("roundtrip mismatch: expected %#v, actual %#v", original, decoded)
	}
	return nil
}

func roundtripEvent(original bank.Event) error {
	encoded, err := bank.EncodeEvent(original)
	if err != nil {
		return fmt.Errorf("encode: %w", err)
	}
	decoded, err := bank.DecodeEvent(encoded)
	if err != nil {
		return fmt.Errorf("decode: %w", err)
	}
	if !reflect.DeepEqual(decoded, original) {
		return fmt.Errorf("roundtrip mismatch: expected %#v, actual %#v", original, decoded)
	}
	return nil
}
