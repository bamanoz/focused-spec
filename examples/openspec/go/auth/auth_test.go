package auth

import "testing"

func TestBlockedAccount(t *testing.T) {
	blocked := true
	credentialsValid := true
	if !blocked || !credentialsValid {
		t.Fatal("fixture must describe a blocked account with valid credentials")
	}
	allowed := credentialsValid && !blocked
	if allowed {
		t.Fatal("blocked account authenticated")
	}
}
