package scenarios

import (
	"context"
	"errors"
	"math"
	"reflect"
	"testing"
	"unsafe"
)

type observedEvent struct {
	Type  string
	Cents int64
}

type hiddenData struct {
	Visible string
	hidden  string
}

type customMarshalData struct {
	Value string
}

func (customMarshalData) MarshalJSON() ([]byte, error) {
	panic("custom marshaler must not run during validation")
}

func validIntScenario(id string) Scenario[int, int, int] {
	return Scenario[int, int, int]{ID: id, Name: "valid scenario", Given: 1, When: 2, Expect: 3}
}

func TestVerifySpecificationExecutesScenario(t *testing.T) {
	scenario := Scenario[int64, int64, int64]{
		ID:     "account.deposit",
		Name:   "A deposit increases the balance",
		Given:  100,
		When:   25,
		Expect: 125,
	}
	driver := Driver[*int64, int64, int64, int64]{
		Given: func(_ context.Context, balance int64) (*int64, error) {
			return &balance, nil
		},
		When: func(_ context.Context, balance *int64, cents int64) (int64, error) {
			*balance += cents
			return *balance, nil
		},
	}

	actual, err := VerifySpecification(context.Background(), driver, scenario)
	if err != nil {
		t.Fatalf("VerifySpecification returned an error: %v", err)
	}
	if actual != 125 {
		t.Fatalf("actual = %d, want 125", actual)
	}
}

func TestInvalidDeclarationBeforePreparation(t *testing.T) {
	tests := []struct {
		name     string
		scenario Scenario[any, int, int]
	}{
		{
			name:     "invalid identity",
			scenario: Scenario[any, int, int]{ID: "\n", Name: "invalid identity", Given: 1, When: 1, Expect: 1},
		},
		{
			name:     "unsupported input",
			scenario: Scenario[any, int, int]{ID: "unsupported", Name: "unsupported input", Given: func() {}, When: 1, Expect: 1},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			prepared := false
			driver := Driver[int, any, int, int]{
				Given: func(context.Context, any) (int, error) {
					prepared = true
					return 0, nil
				},
				When: func(context.Context, int, int) (int, error) { return 1, nil },
			}
			if _, err := VerifySpecification(context.Background(), driver, test.scenario); err == nil {
				t.Fatal("VerifySpecification accepted an invalid declaration")
			}
			if prepared {
				t.Fatal("preparation ran for an invalid declaration")
			}
		})
	}
}

func TestValidateScenarioRejectsNonDataValues(t *testing.T) {
	cycle := map[string]any{}
	cycle["self"] = cycle
	number := 1

	tests := []struct {
		name  string
		value any
	}{
		{name: "function", value: func() {}},
		{name: "channel", value: make(chan int)},
		{name: "unsafe pointer", value: unsafe.Pointer(&number)},
		{name: "nonfinite number", value: math.Inf(1)},
		{name: "unexported state", value: hiddenData{Visible: "visible", hidden: "hidden"}},
		{name: "custom marshaler", value: customMarshalData{Value: "hidden"}},
		{name: "cycle", value: cycle},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			scenario := Scenario[any, int, int]{ID: "invalid.data", Name: "invalid data", Given: test.value, When: 1, Expect: 1}
			if err := ValidateScenario(scenario); err == nil {
				t.Fatalf("ValidateScenario accepted %s", test.name)
			}
		})
	}
}

func TestValidateSuiteRejectsDuplicateIDsAndDriverMetadata(t *testing.T) {
	valid := Suite[int, int, int]{
		Driver:    DriverBinding{Path: "account.driver.go", Export: "AccountDriver"},
		Scenarios: []Scenario[int, int, int]{validIntScenario("one"), validIntScenario("two")},
	}
	if err := ValidateSuite(valid); err != nil {
		t.Fatalf("ValidateSuite rejected a valid suite: %v", err)
	}

	duplicate := valid
	duplicate.Scenarios = []Scenario[int, int, int]{validIntScenario("same"), validIntScenario("same")}
	if err := ValidateSuite(duplicate); err == nil {
		t.Fatal("ValidateSuite accepted duplicate IDs")
	}

	missingPath := valid
	missingPath.Driver.Path = " "
	if err := ValidateSuite(missingPath); err == nil {
		t.Fatal("ValidateSuite accepted a blank driver path")
	}

	unexported := valid
	unexported.Driver.Export = "accountDriver"
	if err := ValidateSuite(unexported); err == nil {
		t.Fatal("ValidateSuite accepted an unexported driver name")
	}
}

func TestExplicitZeroValuesExecute(t *testing.T) {
	scenario := Scenario[int, bool, string]{
		ID:     "zero.values",
		Name:   "Explicit zero values are data",
		Given:  0,
		When:   false,
		Expect: "",
	}
	driver := Driver[int, int, bool, string]{
		Given: func(_ context.Context, value int) (int, error) { return value, nil },
		When:  func(context.Context, int, bool) (string, error) { return "", nil },
	}
	if _, err := VerifySpecification(context.Background(), driver, scenario); err != nil {
		t.Fatalf("VerifySpecification rejected explicit zero values: %v", err)
	}
}

func TestMismatchPreservesActualAndExpected(t *testing.T) {
	expected := []observedEvent{{Type: "MoneyWithdrawn", Cents: 5000}}
	observed := []observedEvent{{Type: "MoneyWithdrawn", Cents: 4999}}
	scenario := Scenario[[]observedEvent, int, []observedEvent]{
		ID:     "account.withdraw",
		Name:   "Withdrawal records the exact amount",
		Given:  nil,
		When:   5000,
		Expect: expected,
	}
	driver := Driver[struct{}, []observedEvent, int, []observedEvent]{
		Given: func(context.Context, []observedEvent) (struct{}, error) { return struct{}{}, nil },
		When:  func(context.Context, struct{}, int) ([]observedEvent, error) { return observed, nil },
	}

	actual, err := VerifySpecification(context.Background(), driver, scenario)
	if !reflect.DeepEqual(actual, observed) {
		t.Fatalf("actual = %#v, want %#v", actual, observed)
	}
	var mismatch *MismatchError
	if !errors.As(err, &mismatch) {
		t.Fatalf("error = %v, want *MismatchError", err)
	}
	if mismatch.ScenarioID != scenario.ID || mismatch.ScenarioName != scenario.Name {
		t.Fatalf("mismatch identity = %q/%q", mismatch.ScenarioID, mismatch.ScenarioName)
	}
	if !reflect.DeepEqual(mismatch.Expected, expected) || !reflect.DeepEqual(mismatch.Actual, observed) {
		t.Fatalf("mismatch lost expected/actual: %#v", mismatch)
	}

	observed[0].Cents = 1
	expected[0].Cents = 2
	if !reflect.DeepEqual(mismatch.Expected, []observedEvent{{Type: "MoneyWithdrawn", Cents: 5000}}) ||
		!reflect.DeepEqual(mismatch.Actual, []observedEvent{{Type: "MoneyWithdrawn", Cents: 4999}}) {
		t.Fatalf("mismatch observations changed after source mutation: %#v", mismatch)
	}
}

func TestMutationCannotRewriteDeclaration(t *testing.T) {
	type nestedValues struct {
		Values []int
	}
	shared := nestedValues{Values: []int{1, 2}}
	scenario := Scenario[nestedValues, nestedValues, nestedValues]{
		ID:     "mutation.isolated",
		Name:   "Driver mutation cannot rewrite the declaration",
		Given:  shared,
		When:   shared,
		Expect: shared,
	}
	driver := Driver[nestedValues, nestedValues, nestedValues, nestedValues]{
		Given: func(_ context.Context, given nestedValues) (nestedValues, error) {
			given.Values[0] = 9
			return given, nil
		},
		When: func(_ context.Context, subject nestedValues, when nestedValues) (nestedValues, error) {
			when.Values[1] = 8
			return nestedValues{Values: []int{subject.Values[0], when.Values[1]}}, nil
		},
	}

	_, err := VerifySpecification(context.Background(), driver, scenario)
	var mismatch *MismatchError
	if !errors.As(err, &mismatch) {
		t.Fatalf("error = %v, want *MismatchError", err)
	}
	wantExpected := nestedValues{Values: []int{1, 2}}
	wantActual := nestedValues{Values: []int{9, 8}}
	if !reflect.DeepEqual(shared, wantExpected) || !reflect.DeepEqual(scenario.Expect, wantExpected) {
		t.Fatalf("declaration was mutated: shared=%v expected=%v", shared, scenario.Expect)
	}
	if !reflect.DeepEqual(mismatch.Expected, wantExpected) || !reflect.DeepEqual(mismatch.Actual, wantActual) {
		t.Fatalf("unexpected mismatch detail: %#v", mismatch)
	}
}

func TestNilAndEmptyAreDifferent(t *testing.T) {
	scenario := Scenario[int, int, []string]{
		ID:     "nil.is.exact",
		Name:   "Nil and empty collections differ",
		Given:  0,
		When:   0,
		Expect: nil,
	}
	driver := Driver[int, int, int, []string]{
		Given: func(context.Context, int) (int, error) { return 0, nil },
		When:  func(context.Context, int, int) ([]string, error) { return []string{}, nil },
	}

	_, err := VerifySpecification(context.Background(), driver, scenario)
	var mismatch *MismatchError
	if !errors.As(err, &mismatch) {
		t.Fatalf("error = %v, want *MismatchError", err)
	}
	expected, ok := mismatch.Expected.([]string)
	if !ok || expected != nil {
		t.Fatalf("expected snapshot = %#v, want nil []string", mismatch.Expected)
	}
	actual, ok := mismatch.Actual.([]string)
	if !ok || actual == nil || len(actual) != 0 {
		t.Fatalf("actual snapshot = %#v, want nonnil empty []string", mismatch.Actual)
	}
}

func TestCleanupPreservesPrimaryFailure(t *testing.T) {
	cleanupFailure := errors.New("cleanup failed")
	cleanupCalls := 0
	scenario := Scenario[int, int, int]{ID: "cleanup.join", Name: "Both failures survive", Given: 0, When: 0, Expect: 1}
	driver := Driver[int, int, int, int]{
		Given: func(context.Context, int) (int, error) { return 0, nil },
		When:  func(context.Context, int, int) (int, error) { return 2, nil },
		Cleanup: func(context.Context, int) error {
			cleanupCalls++
			return cleanupFailure
		},
	}

	_, err := VerifySpecification(context.Background(), driver, scenario)
	var mismatch *MismatchError
	if !errors.As(err, &mismatch) {
		t.Fatalf("error = %v, want joined *MismatchError", err)
	}
	if !errors.Is(err, cleanupFailure) {
		t.Fatalf("error = %v, want cleanup failure", err)
	}
	if cleanupCalls != 1 {
		t.Fatalf("cleanup calls = %d, want 1", cleanupCalls)
	}
}

func TestCancellationAfterPreparationCleansUp(t *testing.T) {
	type contextKey struct{}
	cleanupFailure := errors.New("cleanup after cancellation failed")
	base := context.WithValue(context.Background(), contextKey{}, "preserved")
	ctx, cancel := context.WithCancel(base)
	cleanupCalls := 0
	actionCalls := 0
	scenario := Scenario[int, int, int]{ID: "cancel.cleanup", Name: "Cancellation still cleans up", Given: 0, When: 0, Expect: 0}
	driver := Driver[int, int, int, int]{
		Given: func(context.Context, int) (int, error) { return 1, nil },
		When: func(ctx context.Context, _ int, _ int) (int, error) {
			actionCalls++
			cancel()
			return 0, ctx.Err()
		},
		Cleanup: func(ctx context.Context, _ int) error {
			cleanupCalls++
			if ctx.Err() != nil || ctx.Done() != nil {
				t.Errorf("cleanup received a cancelled context: %v", ctx.Err())
			}
			if got := ctx.Value(contextKey{}); got != "preserved" {
				t.Errorf("cleanup context value = %v, want preserved", got)
			}
			return cleanupFailure
		},
	}

	_, err := VerifySpecification(ctx, driver, scenario)
	if !errors.Is(err, context.Canceled) || !errors.Is(err, cleanupFailure) {
		t.Fatalf("error = %v, want cancellation and cleanup failures", err)
	}
	if actionCalls != 1 || cleanupCalls != 1 {
		t.Fatalf("action/cleanup calls = %d/%d, want 1/1", actionCalls, cleanupCalls)
	}
}

func TestCancellationBeforePreparation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	prepared := false
	scenario := validIntScenario("cancel.before")
	driver := Driver[int, int, int, int]{
		Given: func(context.Context, int) (int, error) {
			prepared = true
			return 0, nil
		},
		When: func(context.Context, int, int) (int, error) { return 3, nil },
	}

	if _, err := VerifySpecification(ctx, driver, scenario); !errors.Is(err, context.Canceled) {
		t.Fatalf("error = %v, want context.Canceled", err)
	}
	if prepared {
		t.Fatal("preparation ran after cancellation")
	}
}

func TestCleanupRunsDuringPanic(t *testing.T) {
	panicValue := &struct{ message string }{message: "action panic"}
	cleanupCalls := 0
	scenario := validIntScenario("panic.cleanup")
	driver := Driver[int, int, int, int]{
		Given: func(context.Context, int) (int, error) { return 0, nil },
		When: func(context.Context, int, int) (int, error) {
			panic(panicValue)
		},
		Cleanup: func(context.Context, int) error {
			cleanupCalls++
			return nil
		},
	}

	var recovered any
	func() {
		defer func() { recovered = recover() }()
		_, _ = VerifySpecification(context.Background(), driver, scenario)
	}()
	if recovered != panicValue {
		t.Fatalf("recovered = %#v, want original panic", recovered)
	}
	if cleanupCalls != 1 {
		t.Fatalf("cleanup calls = %d, want 1", cleanupCalls)
	}
}

func TestPreparationFailureOwnsCleanup(t *testing.T) {
	prepareFailure := errors.New("preparation failed")
	cleanupCalls := 0
	scenario := validIntScenario("prepare.failure")
	driver := Driver[int, int, int, int]{
		Given: func(context.Context, int) (int, error) { return 0, prepareFailure },
		When:  func(context.Context, int, int) (int, error) { return 3, nil },
		Cleanup: func(context.Context, int) error {
			cleanupCalls++
			return nil
		},
	}

	if _, err := VerifySpecification(context.Background(), driver, scenario); !errors.Is(err, prepareFailure) {
		t.Fatalf("error = %v, want preparation failure", err)
	}
	if cleanupCalls != 0 {
		t.Fatalf("cleanup calls = %d, want 0", cleanupCalls)
	}
}
