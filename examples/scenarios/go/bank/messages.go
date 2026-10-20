package bank

import (
	"encoding/json"
)

type commandWire struct {
	Type  string `json:"type"`
	Cents int64  `json:"cents"`
}

type eventWire struct {
	Type   string `json:"type"`
	Cents  int64  `json:"cents"`
	Reason string `json:"reason,omitempty"`
}

// EncodeCommand serializes one bank command without converting integer cents
// through an untyped JSON number.
func EncodeCommand(command Command) ([]byte, error) {
	return json.Marshal(commandWire{Type: command.Type, Cents: command.Cents})
}

// DecodeCommand decodes exactly one typed bank command.
func DecodeCommand(encoded []byte) (Command, error) {
	var wire commandWire
	if err := decodeMessage(encoded, &wire); err != nil {
		return Command{}, err
	}
	return Command{Type: wire.Type, Cents: wire.Cents}, nil
}

// EncodeEvent serializes one bank event without converting integer cents
// through an untyped JSON number.
func EncodeEvent(event Event) ([]byte, error) {
	return json.Marshal(eventWire{Type: event.Type, Cents: event.Cents, Reason: event.Reason})
}

// DecodeEvent decodes exactly one typed bank event.
func DecodeEvent(encoded []byte) (Event, error) {
	var wire eventWire
	if err := decodeMessage(encoded, &wire); err != nil {
		return Event{}, err
	}
	return Event{Type: wire.Type, Cents: wire.Cents, Reason: wire.Reason}, nil
}

func decodeMessage(encoded []byte, target any) error {
	return json.Unmarshal(encoded, target)
}
