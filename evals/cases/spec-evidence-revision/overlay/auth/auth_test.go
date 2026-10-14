package auth

import "testing"

func TestValidActiveAccount(t *testing.T) {
	if !Authenticate(false, true) {
		t.Fatal("active account with valid credentials was rejected")
	}
}

func TestBlockedAccount(t *testing.T) {
	if Authenticate(true, false) {
		t.Fatal("blocked account with invalid credentials authenticated")
	}
}

func TestBlockedAccountWithValidCredentials(t *testing.T) {
	if Authenticate(true, true) {
		t.Fatal("blocked account with valid credentials authenticated")
	}
}
