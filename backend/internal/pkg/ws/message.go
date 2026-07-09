package ws

import "encoding/json"

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func NewMessage(msgType string, payload interface{}) ([]byte, error) {
	var raw json.RawMessage
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		raw = raw[:0]
		raw = data
	}
	return json.Marshal(Message{Type: msgType, Payload: raw})
}

func ErrorMsg(code, message string) ([]byte, error) {
	return NewMessage("error", ErrorPayload{Code: code, Message: message})
}
