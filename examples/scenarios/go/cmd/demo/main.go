package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"example.com/scenario-bank/specifications"
	scenarios "github.com/bamanoz/focused-spec/packages/sdk/go"
)

const (
	maxEvents     = 256
	maxEventBytes = 65_536
)

type eventCollector struct {
	events  []scenarios.ExecutionEvent
	bytes   int
	stopped bool
}

func newEventCollector() *eventCollector {
	return &eventCollector{events: make([]scenarios.ExecutionEvent, 0), bytes: 2}
}

func (c *eventCollector) emit(event scenarios.ExecutionEvent) {
	if c.stopped {
		return
	}
	encoded, err := json.Marshal(event)
	if err != nil {
		panic(err)
	}
	marker := scenarios.TruncatedEvent{Kind: "truncated", Message: "Additional execution events omitted"}
	encodedMarker, err := json.Marshal(marker)
	if err != nil {
		panic(err)
	}
	separator := 0
	if len(c.events) != 0 {
		separator = 1
	}
	if len(c.events) >= maxEvents-1 || c.bytes+separator+len(encoded)+1+len(encodedMarker) > maxEventBytes {
		c.events = append(c.events, marker)
		c.stopped = true
		return
	}
	c.events = append(c.events, event)
	c.bytes += separator + len(encoded)
	if _, terminal := event.(scenarios.TruncatedEvent); terminal {
		c.stopped = true
	}
}

func renderEvent(event scenarios.ExecutionEvent) {
	switch value := event.(type) {
	case scenarios.ObservationEvent:
		encoded, _ := json.Marshal(value.Value)
		fmt.Printf("  %-7s %s\n", strings.ToUpper(value.Name), encoded)
	case scenarios.TextObservationEvent:
		fmt.Printf("  %-7s %s\n", strings.ToUpper(value.Name), value.Text)
	case scenarios.ExplanationEvent:
		if value.Data == nil {
			fmt.Printf("  EXPLAIN %s\n", value.Message)
			return
		}
		encoded, _ := json.Marshal(value.Data)
		fmt.Printf("  EXPLAIN %s %s\n", value.Message, encoded)
	case scenarios.TruncatedEvent:
		fmt.Printf("  TRUNCATED %s\n", value.Message)
	}
}

func main() {
	if err := scenarios.ValidateSuite(specifications.Account); err != nil {
		fmt.Printf("Invalid suite: %v\n", err)
		os.Exit(1)
	}

	businessFailures := 0
	for _, scenario := range specifications.Account.Scenarios {
		fmt.Printf("\n%s\n", scenario.Name)
		collector := newEventCollector()
		ctx := scenarios.WithEvents(context.Background(), collector.emit)
		_, err := scenarios.VerifySpecification(ctx, specifications.AccountDriver, scenario)
		for _, event := range collector.events {
			renderEvent(event)
		}
		if err != nil {
			businessFailures++
			fmt.Printf("  FAIL    %v\n", err)
		} else {
			fmt.Println("  PASS")
		}
	}

	serializationErr := specifications.VerifySerialization()
	if serializationErr != nil {
		fmt.Printf("\nMessage roundtrip: FAIL: %v\n", serializationErr)
	} else {
		fmt.Println("\nMessage roundtrip: PASS")
	}
	fmt.Printf("%d passed, %d failed\n", len(specifications.Account.Scenarios)-businessFailures, businessFailures)
	if businessFailures != 0 || serializationErr != nil {
		os.Exit(1)
	}
}
