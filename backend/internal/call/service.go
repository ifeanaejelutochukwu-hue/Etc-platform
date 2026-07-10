package call

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Service struct {
	host      string
	apiKey    string
	apiSecret string
	http      *http.Client
}

func NewService(host, apiKey, apiSecret string) *Service {
	// Ensure the host has a scheme so http.NewRequest works correctly.
	if host != "" && !strings.HasPrefix(host, "http://") && !strings.HasPrefix(host, "https://") {
		host = "http://" + host
	}
	return &Service{
		host:      host,
		apiKey:    apiKey,
		apiSecret: apiSecret,
		http:      &http.Client{Timeout: 10 * time.Second},
	}
}

type livekitClaims struct {
	Video videoGrant `json:"video"`
	jwt.RegisteredClaims
}

type videoGrant struct {
	Room         string `json:"room"`
	RoomJoin     bool   `json:"roomJoin"`
	CanPublish   bool   `json:"canPublish"`
	CanSubscribe bool   `json:"canSubscribe"`
}

func (s *Service) GenerateToken(identity, roomName string, canPublish bool) (string, error) {
	now := time.Now()
	claims := livekitClaims{
		Video: videoGrant{
			Room:         roomName,
			RoomJoin:     true,
			CanPublish:   canPublish,
			CanSubscribe: true,
		},
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.apiKey,
			Subject:   identity,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = s.apiKey

	tokenStr, err := token.SignedString([]byte(s.apiSecret))
	if err != nil {
		return "", fmt.Errorf("sign livekit token: %w", err)
	}
	return tokenStr, nil
}

func (s *Service) CreateRoom(name string) error {
	payload := map[string]interface{}{
		"name":         name,
		"empty_timeout": 300,
	}
	return s.twirpCall("CreateRoom", payload)
}

func (s *Service) CloseRoom(name string) error {
	payload := map[string]interface{}{
		"room": name,
	}
	return s.twirpCall("DeleteRoom", payload)
}

func (s *Service) twirpCall(method string, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	token, err := s.GenerateToken("server", "admin", true)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/twirp/livekit.RoomService/%s", s.host, method)
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.http.Do(req)
	if err != nil {
		return fmt.Errorf("livekit %s: %w", method, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("livekit %s: status %d", method, resp.StatusCode)
	}
	return nil
}
