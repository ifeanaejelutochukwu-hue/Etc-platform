package auth

type OTPRequest struct {
	Phone string `json:"phone"`
}

type OTPVerify struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  UserDTO `json:"user"`
}

type UserDTO struct {
	ID          string `json:"id"`
	Phone       string `json:"phone"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name,omitempty"`
	AvatarURL   string `json:"avatar_url,omitempty"`
}
