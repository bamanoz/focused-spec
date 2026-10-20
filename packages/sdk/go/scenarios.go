// Package scenarios provides typed, standalone Given/When/Expect execution.
package scenarios

import (
	"context"
	"encoding"
	"encoding/gob"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"go/ast"
	"go/token"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Scenario is a reusable typed Given/When/Expect specification.
type Scenario[Given, When, Expect any] struct {
	ID     string
	Name   string
	Given  Given
	When   When
	Expect Expect
}

// DriverBinding is inert metadata for optional focused-spec integration.
// Standalone callers pass a Driver directly to VerifySpecification.
type DriverBinding struct {
	Path   string
	Export string
}

// Suite groups scenarios that share a driver binding.
type Suite[Given, When, Expect any] struct {
	Driver    DriverBinding
	Scenarios []Scenario[Given, When, Expect]
}

// Driver connects a typed specification to an application boundary.
// Cleanup is optional and runs after every successful preparation.
type Driver[Subject, Given, When, Expect any] struct {
	Given   func(context.Context, Given) (Subject, error)
	When    func(context.Context, Subject, When) (Expect, error)
	Cleanup func(context.Context, Subject) error
}

// ExecutionEvent is one typed record emitted during scenario execution.
// Its concrete values are ObservationEvent, TextObservationEvent and
// ExplanationEvent. TruncatedEvent is reserved for bounded collectors.
type ExecutionEvent interface {
	executionEvent()
}

// ObservationEvent carries a named, faithfully portable JSON value.
type ObservationEvent struct {
	Kind  string `json:"kind"`
	Name  string `json:"name"`
	Value any    `json:"value"`
}

func (ObservationEvent) executionEvent() {}

// TextObservationEvent carries a deterministic textual representation when a
// Go value cannot be represented faithfully by the portable JSON value model.
type TextObservationEvent struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
	Text string `json:"text"`
}

func (TextObservationEvent) executionEvent() {}

// ExplanationEvent records an application decision. Data is omitted when the
// application supplied nil and is otherwise a portable value or fallback text.
type ExplanationEvent struct {
	Kind    string `json:"kind"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

func (ExplanationEvent) executionEvent() {}

// TruncatedEvent marks the terminal boundary of a bounded retained stream.
type TruncatedEvent struct {
	Kind    string `json:"kind"`
	Message string `json:"message"`
}

func (TruncatedEvent) executionEvent() {}

type eventContextKey struct{}

// WithEvents derives a context that synchronously delivers execution events to
// sink. A nil sink disables delivery, including a sink inherited from ctx.
func WithEvents(ctx context.Context, sink func(ExecutionEvent)) context.Context {
	return context.WithValue(ctx, eventContextKey{}, sink)
}

// Explain emits one application explanation when ctx has an event sink.
// A nil data value omits structured data. Unsupported data panics before the
// sink is called, matching the synchronous observer contract.
func Explain(ctx context.Context, message string, data any) {
	sink := eventSink(ctx)
	if sink == nil {
		return
	}
	if strings.TrimSpace(message) == "" {
		panic("explanation message must be nonblank")
	}
	event := ExplanationEvent{Kind: "explanation", Message: message}
	if data != nil {
		if err := validateData(data); err != nil {
			panic(fmt.Sprintf("explanation data: %v", err))
		}
		if portable, ok := portableData(reflect.ValueOf(data)); ok {
			event.Data = portable
		} else {
			event.Data = formatData(reflect.ValueOf(data))
		}
	}
	sink(event)
}

func eventSink(ctx context.Context) func(ExecutionEvent) {
	if ctx == nil {
		return nil
	}
	sink, _ := ctx.Value(eventContextKey{}).(func(ExecutionEvent))
	return sink
}

// MismatchError reports an exact structural mismatch while retaining both
// observations for errors.As callers.
type MismatchError struct {
	ScenarioID   string
	ScenarioName string
	Expected     any
	Actual       any
}

// Error implements error.
func (e *MismatchError) Error() string {
	if e == nil {
		return "<nil>"
	}
	return fmt.Sprintf("%s: %s: expected %#v, actual %#v", e.ScenarioID, e.ScenarioName, e.Expected, e.Actual)
}

// ValidateScenario validates identity and recursively data-only scenario
// values. Explicit zero values are valid declarations.
func ValidateScenario[Given, When, Expect any](scenario Scenario[Given, When, Expect]) error {
	if strings.TrimSpace(scenario.ID) == "" || containsControl(scenario.ID) {
		return errors.New("scenario ID must contain non-whitespace and no control characters")
	}
	if strings.TrimSpace(scenario.Name) == "" {
		return errors.New("scenario name must be nonblank")
	}
	if err := validateData(scenario.Given); err != nil {
		return fmt.Errorf("scenario %q Given: %w", scenario.ID, err)
	}
	if err := validateData(scenario.When); err != nil {
		return fmt.Errorf("scenario %q When: %w", scenario.ID, err)
	}
	if err := validateData(scenario.Expect); err != nil {
		return fmt.Errorf("scenario %q Expect: %w", scenario.ID, err)
	}
	return nil
}

// ValidateSuite validates driver metadata, every scenario and exact ID
// uniqueness. It does not import or execute the driver binding.
func ValidateSuite[Given, When, Expect any](suite Suite[Given, When, Expect]) error {
	if strings.TrimSpace(suite.Driver.Path) == "" || containsControl(suite.Driver.Path) {
		return errors.New("suite driver path must be nonblank and contain no control characters")
	}
	if !token.IsIdentifier(suite.Driver.Export) || !ast.IsExported(suite.Driver.Export) {
		return errors.New("suite driver export must be an exported Go identifier")
	}
	ids := make(map[string]struct{}, len(suite.Scenarios))
	for index, scenario := range suite.Scenarios {
		if err := ValidateScenario(scenario); err != nil {
			return fmt.Errorf("suite scenario %d: %w", index, err)
		}
		if _, exists := ids[scenario.ID]; exists {
			return fmt.Errorf("duplicate scenario ID: %s", scenario.ID)
		}
		ids[scenario.ID] = struct{}{}
	}
	return nil
}

// VerifySpecification validates and executes one scenario. It returns the
// typed actual observation. Comparison uses reflect.DeepEqual exactly.
func VerifySpecification[Subject, Given, When, Expect any](
	ctx context.Context,
	driver Driver[Subject, Given, When, Expect],
	scenario Scenario[Given, When, Expect],
) (actual Expect, err error) {
	if err := ValidateScenario(scenario); err != nil {
		return actual, err
	}
	if ctx == nil {
		return actual, errors.New("context must not be nil")
	}
	if driver.Given == nil || driver.When == nil {
		return actual, errors.New("driver requires Given and When functions")
	}
	if err := ctx.Err(); err != nil {
		return actual, err
	}
	if sink := eventSink(ctx); sink != nil {
		emitObservation(sink, "Given", scenario.Given)
		emitObservation(sink, "When", scenario.When)
		emitObservation(sink, "Expect", scenario.Expect)
	}

	given, when := clonePair(scenario.Given, scenario.When)
	subject, prepareErr := driver.Given(ctx, given)
	if prepareErr != nil {
		return actual, fmt.Errorf("%s: preparation failed: %w", scenario.ID, prepareErr)
	}

	defer func() {
		if driver.Cleanup == nil {
			return
		}
		cleanupErr := driver.Cleanup(context.WithoutCancel(ctx), subject)
		if cleanupErr == nil {
			return
		}
		cleanupErr = fmt.Errorf("%s: cleanup failed: %w", scenario.ID, cleanupErr)
		if err == nil {
			err = cleanupErr
		} else {
			err = errors.Join(err, cleanupErr)
		}
	}()

	if err := ctx.Err(); err != nil {
		return actual, err
	}
	observed, actionErr := driver.When(ctx, subject, when)
	if actionErr != nil {
		return actual, fmt.Errorf("%s: action failed: %w", scenario.ID, actionErr)
	}
	if err := ctx.Err(); err != nil {
		return actual, err
	}
	if err := validateData(observed); err != nil {
		return actual, fmt.Errorf("%s: actual observation: %w", scenario.ID, err)
	}
	if sink := eventSink(ctx); sink != nil {
		emitObservation(sink, "Actual", observed)
	}

	expectedSnapshot := cloneTyped(scenario.Expect, make(map[reference]reflect.Value))
	actualSnapshot := cloneTyped(observed, make(map[reference]reflect.Value))
	actual = actualSnapshot
	if !reflect.DeepEqual(observed, scenario.Expect) {
		return actual, &MismatchError{
			ScenarioID:   scenario.ID,
			ScenarioName: scenario.Name,
			Expected:     expectedSnapshot,
			Actual:       actualSnapshot,
		}
	}
	return actual, nil
}

func emitObservation(sink func(ExecutionEvent), name string, value any) {
	if portable, ok := portableData(reflect.ValueOf(value)); ok {
		sink(ObservationEvent{Kind: "observation", Name: name, Value: portable})
		return
	}
	sink(TextObservationEvent{Kind: "observation", Name: name, Text: formatData(reflect.ValueOf(value))})
}

func containsControl(value string) bool {
	for _, character := range value {
		if unicode.IsControl(character) {
			return true
		}
	}
	return false
}

var marshalHookTypes = []reflect.Type{
	reflect.TypeOf((*json.Marshaler)(nil)).Elem(),
	reflect.TypeOf((*encoding.TextMarshaler)(nil)).Elem(),
	reflect.TypeOf((*encoding.BinaryMarshaler)(nil)).Elem(),
	reflect.TypeOf((*xml.Marshaler)(nil)).Elem(),
	reflect.TypeOf((*gob.GobEncoder)(nil)).Elem(),
}

func hasMarshalHook(valueType reflect.Type) bool {
	for _, hookType := range marshalHookTypes {
		if valueType.Implements(hookType) {
			return true
		}
		if valueType.Kind() != reflect.Pointer && reflect.PointerTo(valueType).Implements(hookType) {
			return true
		}
	}
	return false
}

type reference struct {
	valueType reflect.Type
	kind      reflect.Kind
	pointer   uintptr
	length    int
	capacity  int
}

func dataReference(value reflect.Value) (reference, bool) {
	switch value.Kind() {
	case reflect.Map, reflect.Pointer, reflect.Slice:
		if value.IsNil() {
			return reference{}, false
		}
		item := reference{valueType: value.Type(), kind: value.Kind(), pointer: value.Pointer()}
		if value.Kind() == reflect.Slice {
			item.length = value.Len()
			item.capacity = value.Cap()
		}
		return item, true
	default:
		return reference{}, false
	}
}

func validateData(value any) error {
	return validateDataValue(reflect.ValueOf(value), "value", make(map[reference]struct{}))
}

func validateDataValue(value reflect.Value, path string, ancestors map[reference]struct{}) error {
	if !value.IsValid() {
		return nil
	}
	if hasMarshalHook(value.Type()) {
		return fmt.Errorf("%s uses custom marshaling", path)
	}

	if item, ok := dataReference(value); ok {
		if _, exists := ancestors[item]; exists {
			return fmt.Errorf("%s contains a cycle", path)
		}
		ancestors[item] = struct{}{}
		defer delete(ancestors, item)
	}

	switch value.Kind() {
	case reflect.Interface:
		if value.IsNil() {
			return nil
		}
		return validateDataValue(value.Elem(), path, ancestors)
	case reflect.Bool,
		reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr,
		reflect.String:
		return nil
	case reflect.Float32, reflect.Float64:
		if number := value.Float(); math.IsInf(number, 0) || math.IsNaN(number) {
			return fmt.Errorf("%s must be finite", path)
		}
		return nil
	case reflect.Complex64, reflect.Complex128:
		number := value.Complex()
		if math.IsInf(real(number), 0) || math.IsNaN(real(number)) || math.IsInf(imag(number), 0) || math.IsNaN(imag(number)) {
			return fmt.Errorf("%s must be finite", path)
		}
		return nil
	case reflect.Array, reflect.Slice:
		for index := range value.Len() {
			if err := validateDataValue(value.Index(index), fmt.Sprintf("%s[%d]", path, index), ancestors); err != nil {
				return err
			}
		}
		return nil
	case reflect.Map:
		if hasMarshalHook(value.Type().Key()) {
			return fmt.Errorf("%s map key uses custom marshaling", path)
		}
		iterator := value.MapRange()
		index := 0
		for iterator.Next() {
			if err := validateDataValue(iterator.Key(), fmt.Sprintf("%s key %d", path, index), ancestors); err != nil {
				return err
			}
			if err := validateDataValue(iterator.Value(), fmt.Sprintf("%s value %d", path, index), ancestors); err != nil {
				return err
			}
			index++
		}
		return nil
	case reflect.Struct:
		valueType := value.Type()
		for index := range value.NumField() {
			field := valueType.Field(index)
			if !field.IsExported() {
				return fmt.Errorf("%s.%s contains unexported state", path, field.Name)
			}
			if err := validateDataValue(value.Field(index), path+"."+field.Name, ancestors); err != nil {
				return err
			}
		}
		return nil
	case reflect.Pointer:
		if value.IsNil() {
			return nil
		}
		return validateDataValue(value.Elem(), path, ancestors)
	case reflect.Chan, reflect.Func, reflect.UnsafePointer:
		return fmt.Errorf("%s contains unsupported %s data", path, value.Kind())
	default:
		return fmt.Errorf("%s contains unsupported %s data", path, value.Kind())
	}
}

func clonePair[First, Second any](first First, second Second) (First, Second) {
	memo := make(map[reference]reflect.Value)
	return cloneTyped(first, memo), cloneTyped(second, memo)
}

func cloneTyped[Value any](value Value, memo map[reference]reflect.Value) Value {
	var clone Value
	source := reflect.ValueOf(value)
	if !source.IsValid() {
		return clone
	}
	target := reflect.ValueOf(&clone).Elem()
	target.Set(cloneDataValue(source, memo))
	return clone
}

func cloneDataValue(value reflect.Value, memo map[reference]reflect.Value) reflect.Value {
	if item, ok := dataReference(value); ok {
		if clone, exists := memo[item]; exists {
			return clone
		}
	}

	switch value.Kind() {
	case reflect.Interface:
		if value.IsNil() {
			return reflect.Zero(value.Type())
		}
		clone := reflect.New(value.Type()).Elem()
		clone.Set(cloneDataValue(value.Elem(), memo))
		return clone
	case reflect.Pointer:
		if value.IsNil() {
			return reflect.Zero(value.Type())
		}
		clone := reflect.New(value.Type().Elem())
		item, _ := dataReference(value)
		memo[item] = clone
		clone.Elem().Set(cloneDataValue(value.Elem(), memo))
		return clone
	case reflect.Slice:
		if value.IsNil() {
			return reflect.Zero(value.Type())
		}
		clone := reflect.MakeSlice(value.Type(), value.Len(), value.Cap())
		item, _ := dataReference(value)
		memo[item] = clone
		for index := range value.Len() {
			clone.Index(index).Set(cloneDataValue(value.Index(index), memo))
		}
		return clone
	case reflect.Map:
		if value.IsNil() {
			return reflect.Zero(value.Type())
		}
		clone := reflect.MakeMapWithSize(value.Type(), value.Len())
		item, _ := dataReference(value)
		memo[item] = clone
		iterator := value.MapRange()
		for iterator.Next() {
			clone.SetMapIndex(cloneDataValue(iterator.Key(), memo), cloneDataValue(iterator.Value(), memo))
		}
		return clone
	case reflect.Array:
		clone := reflect.New(value.Type()).Elem()
		for index := range value.Len() {
			clone.Index(index).Set(cloneDataValue(value.Index(index), memo))
		}
		return clone
	case reflect.Struct:
		clone := reflect.New(value.Type()).Elem()
		for index := range value.NumField() {
			clone.Field(index).Set(cloneDataValue(value.Field(index), memo))
		}
		return clone
	default:
		return value
	}
}

const maxExactJSONInteger = uint64(1<<53 - 1)

func portableData(value reflect.Value) (any, bool) {
	if !value.IsValid() {
		return nil, true
	}
	switch value.Kind() {
	case reflect.Interface, reflect.Pointer:
		if value.IsNil() {
			return nil, true
		}
		return portableData(value.Elem())
	case reflect.Bool:
		return value.Bool(), true
	case reflect.String:
		if !utf8.ValidString(value.String()) {
			return nil, false
		}
		return value.String(), true
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		number := value.Int()
		if number < -int64(maxExactJSONInteger) || number > int64(maxExactJSONInteger) {
			return nil, false
		}
		return number, true
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		number := value.Uint()
		if number > maxExactJSONInteger {
			return nil, false
		}
		return number, true
	case reflect.Float32, reflect.Float64:
		number := value.Float()
		if number == 0 && math.Signbit(number) {
			return nil, false
		}
		return number, true
	case reflect.Complex64, reflect.Complex128:
		return nil, false
	case reflect.Array:
		items := make([]any, value.Len())
		for index := range value.Len() {
			item, ok := portableData(value.Index(index))
			if !ok {
				return nil, false
			}
			items[index] = item
		}
		return items, true
	case reflect.Slice:
		if value.IsNil() {
			return nil, true
		}
		if value.Type().Elem().Kind() == reflect.Uint8 {
			return nil, false
		}
		items := make([]any, value.Len())
		for index := range value.Len() {
			item, ok := portableData(value.Index(index))
			if !ok {
				return nil, false
			}
			items[index] = item
		}
		return items, true
	case reflect.Map:
		if value.IsNil() {
			return nil, true
		}
		if value.Type().Key().Kind() != reflect.String {
			return nil, false
		}
		result := make(map[string]any, value.Len())
		iterator := value.MapRange()
		for iterator.Next() {
			if !utf8.ValidString(iterator.Key().String()) {
				return nil, false
			}
			item, ok := portableData(iterator.Value())
			if !ok {
				return nil, false
			}
			result[iterator.Key().String()] = item
		}
		return result, true
	case reflect.Struct:
		result := make(map[string]any, value.NumField())
		valueType := value.Type()
		for index := range value.NumField() {
			field := valueType.Field(index)
			name, include := jsonFieldName(field)
			if !include {
				return nil, false
			}
			if !utf8.ValidString(name) {
				return nil, false
			}
			if _, exists := result[name]; exists {
				return nil, false
			}
			item, ok := portableData(value.Field(index))
			if !ok {
				return nil, false
			}
			result[name] = item
		}
		return result, true
	default:
		return nil, false
	}
}

func jsonFieldName(field reflect.StructField) (string, bool) {
	tag := field.Tag.Get("json")
	if field.Anonymous && tag == "" {
		return "", false
	}
	name, _, _ := strings.Cut(tag, ",")
	if name == "-" {
		return "", false
	}
	if name == "" {
		name = field.Name
	}
	return name, true
}

func formatData(value reflect.Value) string {
	if !value.IsValid() {
		return "nil"
	}
	switch value.Kind() {
	case reflect.Interface:
		if value.IsNil() {
			return "nil"
		}
		return formatData(value.Elem())
	case reflect.Pointer:
		if value.IsNil() {
			return "nil"
		}
		return "&" + formatData(value.Elem())
	case reflect.Bool:
		return strconv.FormatBool(value.Bool())
	case reflect.String:
		return strconv.Quote(value.String())
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.FormatInt(value.Int(), 10)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return strconv.FormatUint(value.Uint(), 10)
	case reflect.Float32, reflect.Float64:
		return strconv.FormatFloat(value.Float(), 'g', -1, value.Type().Bits())
	case reflect.Complex64, reflect.Complex128:
		return strconv.FormatComplex(value.Complex(), 'g', -1, value.Type().Bits())
	case reflect.Array, reflect.Slice:
		if value.Kind() == reflect.Slice && value.IsNil() {
			return "nil"
		}
		parts := make([]string, value.Len())
		for index := range value.Len() {
			parts[index] = formatData(value.Index(index))
		}
		return value.Type().String() + "{" + strings.Join(parts, ", ") + "}"
	case reflect.Map:
		if value.IsNil() {
			return "nil"
		}
		keys := value.MapKeys()
		parts := make([]string, len(keys))
		for index, key := range keys {
			parts[index] = formatData(key) + ": " + formatData(value.MapIndex(key))
		}
		sort.Strings(parts)
		return value.Type().String() + "{" + strings.Join(parts, ", ") + "}"
	case reflect.Struct:
		parts := make([]string, value.NumField())
		valueType := value.Type()
		for index := range value.NumField() {
			parts[index] = valueType.Field(index).Name + ": " + formatData(value.Field(index))
		}
		return valueType.String() + "{" + strings.Join(parts, ", ") + "}"
	default:
		return value.Type().String()
	}
}
